import { Inject, Injectable } from '@nestjs/common';
import type { FraudAlert, FraudAlertQuery } from '@tradenest/contracts/ai';
import type { ProductQuery } from '@tradenest/contracts/products';
import { AuthorizationService } from '../../common/authorization/index.js';
import { ANALYTICS_MODULE_API, type AnalyticsModuleApi } from '../analytics/public/module-api.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { CATALOG_MODULE_API, type CatalogModuleApi } from '../catalog/public/module-api.js';
import { DISPUTES_MODULE_API, type DisputesModuleApi } from '../disputes/public/module-api.js';
import { ESCROW_MODULE_API, type EscrowModuleApi } from '../escrow/public/module-api.js';
import { ORDERS_MODULE_API, type OrdersModuleApi } from '../orders/public/module-api.js';
import { PAYMENTS_MODULE_API, type PaymentsModuleApi } from '../payments/public/module-api.js';
import { SELLER_MODULE_API, type SellerModuleApi } from '../seller/public/module-api.js';
import { USERS_MODULE_API, type UsersModuleApi } from '../users/public/module-api.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly authorization: AuthorizationService,
    @Inject(ANALYTICS_MODULE_API) private readonly analytics: AnalyticsModuleApi,
    @Inject(USERS_MODULE_API) private readonly users: UsersModuleApi,
    @Inject(SELLER_MODULE_API) private readonly sellers: SellerModuleApi,
    @Inject(CATALOG_MODULE_API) private readonly catalog: CatalogModuleApi,
    @Inject(ORDERS_MODULE_API) private readonly orders: OrdersModuleApi,
    @Inject(PAYMENTS_MODULE_API) private readonly payments: PaymentsModuleApi,
    @Inject(ESCROW_MODULE_API) private readonly escrow: EscrowModuleApi,
    @Inject(DISPUTES_MODULE_API) private readonly disputes: DisputesModuleApi,
  ) {}

  private requireAdmin(principal: AuthPrincipal): void {
    this.authorization.requireRole(principal, ['ADMIN']);
  }

  async dashboard(principal: AuthPrincipal) {
    this.requireAdmin(principal);
    const [users, sellers, products, orders, payments, escrows, disputes, fraudAlerts] = await Promise.all([
      this.users.adminListUsers(1, 1),
      this.sellers.adminListSellers(1, 1),
      this.catalog.adminListProducts({ page: 1, limit: 1 }),
      this.orders.adminListOrders(1, 1),
      this.payments.adminListPayments(1, 1),
      this.escrow.adminListEscrows(1, 1),
      this.disputes.adminListDisputes(1, 100),
      this.analytics.listFraudAlerts({ limit: 100 }),
    ]);
    return {
      counts: {
        users: users.total, sellers: sellers.total, products: products.meta.total, orders: orders.total,
        payments: payments.total, escrows: escrows.total, disputes: disputes.total, recentFraudAlerts: fraudAlerts.length,
      },
      openDisputes: disputes.open,
      recentHighRiskAlerts: fraudAlerts.filter((item) => item.riskLevel === 'HIGH').length,
    };
  }

  async suspendUser(principal: AuthPrincipal, id: string, reason: string) { this.requireAdmin(principal); return this.users.adminSuspendUser(principal, id, reason); }
  async reactivateUser(principal: AuthPrincipal, id: string, reason: string) { this.requireAdmin(principal); return this.users.adminReactivateUser(principal, id, reason); }
  async suspendSeller(principal: AuthPrincipal, id: string, reason: string) { this.requireAdmin(principal); return this.sellers.adminSuspendSeller(principal, id, reason); }
  async reactivateSeller(principal: AuthPrincipal, id: string, reason: string) { this.requireAdmin(principal); return this.sellers.adminReactivateSeller(principal, id, reason); }
  async suspendProduct(principal: AuthPrincipal, id: string, reason: string) { this.requireAdmin(principal); return this.catalog.adminSuspendProduct(principal, id, reason); }
  async reactivateProduct(principal: AuthPrincipal, id: string, reason: string) { this.requireAdmin(principal); return this.catalog.adminReactivateProduct(principal, id, reason); }

  async usersList(principal: AuthPrincipal, page: number, limit: number) { this.requireAdmin(principal); return this.page(await this.users.adminListUsers(page, limit), page, limit); }
  async sellersList(principal: AuthPrincipal, page: number, limit: number) { this.requireAdmin(principal); return this.page(await this.sellers.adminListSellers(page, limit), page, limit); }
  async productsList(principal: AuthPrincipal, query: ProductQuery) { this.requireAdmin(principal); return this.catalog.adminListProducts(query); }
  async ordersList(principal: AuthPrincipal, page: number, limit: number) { this.requireAdmin(principal); return this.page(await this.orders.adminListOrders(page, limit), page, limit); }
  async paymentsList(principal: AuthPrincipal, page: number, limit: number) { this.requireAdmin(principal); return this.page(await this.payments.adminListPayments(page, limit), page, limit); }
  async escrowsList(principal: AuthPrincipal, page: number, limit: number) { this.requireAdmin(principal); return this.page(await this.escrow.adminListEscrows(page, limit), page, limit); }
  async disputesList(principal: AuthPrincipal, page: number, limit: number) { this.requireAdmin(principal); const result = await this.disputes.adminListDisputes(page, limit); return { data: result.rows, meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } }; }

  async fraudAlerts(principal: AuthPrincipal, query: FraudAlertQuery): Promise<FraudAlert[]> {
    this.requireAdmin(principal);
    return this.analytics.listFraudAlerts(query);
  }

  private page<T>(result: { rows: T[]; total: number }, page: number, limit: number) {
    return { data: result.rows, meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
  }
}
