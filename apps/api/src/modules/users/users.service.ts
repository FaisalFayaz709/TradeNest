import { randomUUID as notificationEventId } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { NOTIFICATIONS_MODULE_API, type NotificationsModuleApi } from '../notifications/public/module-api.js';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/index.js';
import { DatabaseTransactionService } from '../../database/database-transaction.service.js';
import type {
  Address,
  CreateAddressInput,
  DeleteAccountResult,
  DeleteAddressResult,
  UpdateAddressInput,
  UpdateUserProfileInput,
  UserProfile,
} from '@tradenest/contracts/users';
import { AuthorizationService } from '../../common/authorization/authorization.service.js';
import { ApiException } from '../../common/http/api-exception.js';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { AccountDeletionBlockedRepositoryError } from './users.errors.js';
import { UsersRepository } from './users.repository.js';
import type { AddressRecord, UserProfileRecord } from './users.types.js';
import type { CheckoutAddressSnapshot, UsersModuleApi } from './public/module-api.js';

@Injectable()
export class UsersService implements UsersModuleApi {
  constructor(
    private readonly repository: UsersRepository,
    private readonly authorization: AuthorizationService,
    private readonly transactions: DatabaseTransactionService,
    private readonly audit: AuditService,
    @Inject(NOTIFICATIONS_MODULE_API) private readonly notifications: NotificationsModuleApi,
  ) {}

  async adminListUsers(page: number, limit: number) {
    const result = await this.repository.listUsers(page, limit);
    return { rows: result.rows.map((row) => this.toProfile(row)), total: result.total };
  }

  async adminSuspendUser(actor: AuthPrincipal, targetId: string, reason: string) {
    return this.adminChangeUserStatus(actor, targetId, 'ACTIVE', 'SUSPENDED', reason);
  }

  async adminReactivateUser(actor: AuthPrincipal, targetId: string, reason: string) {
    return this.adminChangeUserStatus(actor, targetId, 'SUSPENDED', 'ACTIVE', reason);
  }

  private async adminChangeUserStatus(
    actor: AuthPrincipal, targetId: string, from: 'ACTIVE' | 'SUSPENDED',
    to: 'ACTIVE' | 'SUSPENDED', reason: string,
  ) {
    this.authorization.requireRole(actor, ['ADMIN']);
    if (actor.userId === targetId) throw new ApiException(403, {
      code: 'ADMIN_SELF_MODERATION_FORBIDDEN', message: 'Administrators cannot moderate their own account.',
    });
    return this.transactions.runSerializable(async (transaction) => {
      const before = await this.repository.findUserById(targetId, transaction);
      if (!before) throw this.userNotFound();
      if (before.role === 'ADMIN') throw new ApiException(403, {
        code: 'ADMIN_PEER_MODERATION_FORBIDDEN', message: 'Administrator accounts require a separate privileged process.',
      });
      if (before.status !== from) throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION', message: `Cannot change user status from ${before.status} to ${to}.`,
      });
      const updated = await this.repository.adminTransitionUserStatus(targetId, from, to, transaction);
      if (!updated) throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION', message: 'User status changed concurrently.',
      });
      if (to === 'SUSPENDED') await this.repository.revokeUserSessions(targetId, transaction);
      await this.audit.write({
        actorId: actor.userId, action: to === 'SUSPENDED' ? 'ADMIN_USER_SUSPEND' : 'ADMIN_USER_REACTIVATE',
        entityType: 'user', entityId: targetId,
        before: { status: from }, after: { status: to }, metadata: { reason },
      }, transaction);
      await this.notifications.record({ key: `ACCOUNT_MODERATED:${notificationEventId()}`, type: 'ACCOUNT_MODERATED',
        title: to === 'SUSPENDED' ? 'Account suspended' : 'Account reactivated',
        body: `An administrator changed your account status to ${to.toLowerCase()}.`,
        recipients: [targetId],
      }, transaction);
      return this.toProfile(updated);
    });
  }

  async requireOwnedCheckoutAddress(
    userId: string,
    addressId: string,
    transaction: DatabaseTransactionContext,
  ): Promise<CheckoutAddressSnapshot> {
    const address = await this.repository.findAddressById(addressId, transaction);
    if (!address || address.userId !== userId) throw this.addressNotFound();
    return {
      addressId: address.id,
      recipient: address.recipient,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      region: address.region,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
    };
  }

  async me(principal: AuthPrincipal): Promise<UserProfile> {
    const user = await this.requireUser(principal.userId);
    this.authorization.requireOwnership(principal, user.id);
    return this.toProfile(user);
  }

  async updateMe(principal: AuthPrincipal, input: UpdateUserProfileInput): Promise<UserProfile> {
    const user = await this.repository.updateUserName(principal.userId, input.name);
    if (!user) throw this.userNotFound();
    this.authorization.requireOwnership(principal, user.id);
    return this.toProfile(user);
  }

  async deleteMe(principal: AuthPrincipal): Promise<DeleteAccountResult> {
    try {
      const deleted = await this.repository.deleteUser(principal.userId);
      if (!deleted) throw this.userNotFound();
      return { deleted: true };
    } catch (error) {
      if (error instanceof AccountDeletionBlockedRepositoryError) {
        throw new ApiException(409, {
          code: 'ACCOUNT_DELETION_REQUIRES_REVIEW',
          message: 'This account has protected marketplace history and cannot be deleted automatically.',
        });
      }
      throw error;
    }
  }

  async listAddresses(principal: AuthPrincipal): Promise<Address[]> {
    return (await this.repository.listAddresses(principal.userId)).map((row) => this.toAddress(row));
  }

  async createAddress(principal: AuthPrincipal, input: CreateAddressInput): Promise<Address> {
    return this.toAddress(await this.repository.createAddress(principal.userId, input));
  }

  async updateAddress(
    principal: AuthPrincipal,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<Address> {
    await this.requireOwnedAddress(principal, addressId);
    const updated = await this.repository.updateAddress(addressId, input);
    if (!updated) throw this.addressNotFound();
    return this.toAddress(updated);
  }

  async deleteAddress(principal: AuthPrincipal, addressId: string): Promise<DeleteAddressResult> {
    await this.requireOwnedAddress(principal, addressId);
    if (!(await this.repository.deleteAddress(addressId))) throw this.addressNotFound();
    return { deleted: true };
  }

  private async requireUser(userId: string): Promise<UserProfileRecord> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw this.userNotFound();
    return user;
  }

  private async requireOwnedAddress(principal: AuthPrincipal, addressId: string): Promise<AddressRecord> {
    const address = await this.repository.findAddressById(addressId);
    if (!address) throw this.addressNotFound();
    this.authorization.requireOwnership(principal, address.userId, {
      conceal: true,
      resourceCode: 'ADDRESS_NOT_FOUND',
    });
    return address;
  }

  private toProfile(user: UserProfileRecord): UserProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private toAddress(row: AddressRecord): Address {
    return {
      id: row.id,
      userId: row.userId,
      label: row.label,
      recipient: row.recipient,
      line1: row.line1,
      line2: row.line2,
      city: row.city,
      region: row.region,
      postalCode: row.postalCode,
      country: row.country,
      phone: row.phone,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private userNotFound(): ApiException {
    return new ApiException(404, { code: 'USER_NOT_FOUND', message: 'The user account was not found.' });
  }

  private addressNotFound(): ApiException {
    return new ApiException(404, { code: 'ADDRESS_NOT_FOUND', message: 'The requested address was not found.' });
  }
}
