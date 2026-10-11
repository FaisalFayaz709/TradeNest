import { randomUUID as notificationEventId } from 'node:crypto';
import { NOTIFICATIONS_MODULE_API, type NotificationsModuleApi } from '../notifications/public/module-api.js';
import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/index.js';
import { DatabaseTransactionService } from '../../database/database-transaction.service.js';
import type {
  OnboardSellerInput,
  SellerDashboard,
  SellerProfile,
  UpdateSellerProfileInput,
} from '@tradenest/contracts/seller';
import { ApiException } from '../../common/http/api-exception.js';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { AUTH_MODULE_API, type AuthModuleApi, type AuthPrincipal } from '../auth/public/module-api.js';
import { SellerProfileAlreadyExistsRepositoryError } from './seller.errors.js';
import { SellerRepository } from './seller.repository.js';
import type { SellerProfileRecord } from './seller.types.js';
import type { ActiveSeller, SellerIdentity, SellerModuleApi } from './public/module-api.js';

@Injectable()
export class SellerService implements SellerModuleApi {
  constructor(
    private readonly repository: SellerRepository,
    private readonly transactions: DatabaseTransactionService,
    private readonly audit: AuditService,
    @Inject(NOTIFICATIONS_MODULE_API) private readonly notifications: NotificationsModuleApi,
    @Inject(AUTH_MODULE_API) private readonly auth: AuthModuleApi,
  ) {}

  async adminListSellers(page: number, limit: number) {
    const result = await this.repository.list(page, limit);
    return { rows: result.rows.map((row) => this.toProfile(row)), total: result.total };
  }

  async adminSuspendSeller(actor: AuthPrincipal, sellerId: string, reason: string) {
    return this.adminChangeSellerStatus(actor, sellerId, 'ACTIVE', 'SUSPENDED', reason);
  }

  async adminReactivateSeller(actor: AuthPrincipal, sellerId: string, reason: string) {
    return this.adminChangeSellerStatus(actor, sellerId, 'SUSPENDED', 'ACTIVE', reason);
  }

  private async adminChangeSellerStatus(
    actor: AuthPrincipal, sellerId: string, from: 'ACTIVE' | 'SUSPENDED',
    to: 'ACTIVE' | 'SUSPENDED', reason: string,
  ) {
    if (actor.role !== 'ADMIN') throw new ApiException(403, {
      code: 'ROLE_FORBIDDEN', message: 'Only administrators can moderate seller accounts.',
    });
    return this.transactions.runSerializable(async (transaction) => {
      const before = await this.repository.findByUserId(sellerId, transaction);
      if (!before) throw this.profileNotFound();
      if (before.status !== from) throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION', message: `Cannot change seller status from ${before.status} to ${to}.`,
      });
      if (to === 'ACTIVE' && !(await this.auth.isAccountActive(sellerId, transaction))) {
        throw new ApiException(409, {
          code: 'SELLER_ACCOUNT_NOT_ACTIVE', message: 'Activate the seller user account first.',
        });
      }
      const updated = await this.repository.adminTransitionSellerStatus(sellerId, from, to, transaction);
      if (!updated) throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION', message: 'Seller status changed concurrently.',
      });
      await this.audit.write({
        actorId: actor.userId, action: to === 'SUSPENDED' ? 'ADMIN_SELLER_SUSPEND' : 'ADMIN_SELLER_REACTIVATE',
        entityType: 'seller_profile', entityId: sellerId,
        before: { status: from }, after: { status: to }, metadata: { reason },
      }, transaction);
      await this.notifications.record({ key: `SELLER_MODERATED:${notificationEventId()}`, type: 'SELLER_MODERATED',
        title: to === 'SUSPENDED' ? 'Store suspended' : 'Store reactivated',
        body: `An administrator changed your store status to ${to.toLowerCase()}.`, recipients: [sellerId],
      }, transaction);
      return this.toProfile(updated);
    });
  }

  async onboard(principal: AuthPrincipal, input: OnboardSellerInput): Promise<SellerProfile> {
    this.assertSellerRole(principal);

    const existing = await this.repository.findByUserId(principal.userId);
    if (existing) {
      throw new ApiException(409, {
        code: 'SELLER_PROFILE_ALREADY_EXISTS',
        message: 'A seller profile already exists for this account.',
      });
    }

    try {
      const profile = await this.repository.createActiveProfile(
        principal.userId,
        input.storeName.trim(),
        this.createStableSlug(input.storeName, principal.userId),
      );
      return this.toProfile(profile);
    } catch (error) {
      if (error instanceof SellerProfileAlreadyExistsRepositoryError) {
        throw new ApiException(409, {
          code: 'SELLER_PROFILE_ALREADY_EXISTS',
          message: 'A seller profile already exists for this account.',
        });
      }
      throw error;
    }
  }

  async profile(principal: AuthPrincipal): Promise<SellerProfile> {
    this.assertSellerRole(principal);
    return this.toProfile(await this.requireProfile(principal.userId));
  }

  async updateProfile(principal: AuthPrincipal, input: UpdateSellerProfileInput): Promise<SellerProfile> {
    this.assertSellerRole(principal);
    await this.requireProfile(principal.userId);
    const updated = await this.repository.updateStoreName(principal.userId, input.storeName.trim());
    if (!updated) throw this.profileNotFound();
    return this.toProfile(updated);
  }

  async dashboard(principal: AuthPrincipal): Promise<SellerDashboard> {
    this.assertSellerRole(principal);
    return { profile: this.toProfile(await this.requireProfile(principal.userId)) };
  }

  async requireSellerProfile(userId: string, transaction?: DatabaseTransactionContext): Promise<SellerIdentity> {
    const profile = await this.requireProfile(userId, transaction);
    return {
      userId: profile.userId,
      storeName: profile.storeName,
      slug: profile.slug,
      status: profile.status,
    };
  }

  /**
   * Explicit public seam for later product/catalog logic. The blueprint says
   * only an ACTIVE seller can create products. This method exposes exactly
   * that policy without exposing SellerRepository or Prisma across modules.
   */
  async requireActiveSeller(userId: string, transaction?: DatabaseTransactionContext): Promise<ActiveSeller> {
    const profile = await this.requireProfile(userId, transaction);
    if (profile.status !== 'ACTIVE' || !(await this.auth.isAccountActive(userId, transaction))) {
      throw new ApiException(403, {
        code: 'SELLER_NOT_ACTIVE',
        message: 'An active seller profile is required for this action.',
      });
    }
    return {
      userId: profile.userId,
      storeName: profile.storeName,
      slug: profile.slug,
      status: 'ACTIVE',
    };
  }

  private async requireProfile(userId: string, transaction?: DatabaseTransactionContext): Promise<SellerProfileRecord> {
    const profile = await this.repository.findByUserId(userId, transaction);
    if (!profile) throw this.profileNotFound();
    return profile;
  }

  private assertSellerRole(principal: AuthPrincipal): void {
    if (principal.role !== 'SELLER') {
      throw new ApiException(403, {
        code: 'SELLER_ROLE_REQUIRED',
        message: 'A seller account is required for this action.',
      });
    }
  }

  private createStableSlug(storeName: string, userId: string): string {
    const base = storeName
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180) || 'seller';
    const suffix = userId.replace(/-/g, '').slice(0, 12).toLowerCase();
    return `${base}-${suffix}`.slice(0, 220);
  }

  private toProfile(row: SellerProfileRecord): SellerProfile {
    return {
      userId: row.userId,
      storeName: row.storeName,
      slug: row.slug,
      status: row.status,
      rating: row.rating === null ? null : Number(row.rating.toString()),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private profileNotFound(): ApiException {
    return new ApiException(404, {
      code: 'SELLER_PROFILE_NOT_FOUND',
      message: 'The seller profile was not found.',
    });
  }
}
