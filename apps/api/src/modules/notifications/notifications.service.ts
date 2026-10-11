import { Injectable } from '@nestjs/common';
import { NotificationSchema, NotificationsQuerySchema, type NotificationsQuery } from '@tradenest/contracts/notifications';
import { ApiException } from '../../common/http/api-exception.js';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { NotificationsRepository } from './notifications.repository.js';
import type { NotificationEvent, NotificationsModuleApi } from './public/module-api.js';

@Injectable()
export class NotificationsService implements NotificationsModuleApi {
  constructor(private readonly repository: NotificationsRepository) {}

  async record(event: NotificationEvent, transaction: DatabaseTransactionContext): Promise<void> {
    if (!transaction) throw new Error('Notifications must be written in the originating transaction');
    if (!/^[A-Z_]+:[a-zA-Z0-9-]{1,90}$/.test(event.key) || event.key.length > 110) throw new Error('Invalid notification event key');
    if (!event.title || event.title.length > 200 || !event.body || event.body.length > 2000) throw new Error('Invalid notification content');
    if (event.recipients.some(userId => !/^[0-9a-f-]{36}$/i.test(userId))) throw new Error('Invalid notification recipient');
    await this.repository.createEvent(event, transaction);
  }

  async list(principal: AuthPrincipal, raw: NotificationsQuery) {
    const { page, limit, unreadOnly } = NotificationsQuerySchema.parse(raw);
    const [rows, total] = await Promise.all([
      this.repository.list(principal.userId, page, limit, unreadOnly === 'true'),
      this.repository.count(principal.userId, unreadOnly === 'true'),
    ]);
    return { data: rows.map(row => this.map(row)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async unread(principal: AuthPrincipal) {
    return { count: await this.repository.count(principal.userId, true) };
  }
  async markRead(principal: AuthPrincipal, id: string) {
    await this.repository.read(principal.userId, id, new Date());
    const result = await this.repository.findOwned(principal.userId, id);
    if (!result) throw new ApiException(404, { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found.' });
    return this.map(result);
  }
  async markAllRead(principal: AuthPrincipal) {
    const result = await this.repository.readAll(principal.userId, new Date());
    return { updated: result.count };
  }
  private map(row: { id: string; type: string; title: string; body: string; readAt: Date | null; createdAt: Date }) {
    return NotificationSchema.parse({ id: row.id, type: row.type, title: row.title, body: row.body,
      readAt: row.readAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() });
  }
}
