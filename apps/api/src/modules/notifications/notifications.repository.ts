import { Injectable } from '@nestjs/common';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { NotificationEvent } from './public/module-api.js';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(event: NotificationEvent, transaction: DatabaseTransactionContext): Promise<void> {
    // Unique (event_key) prevents a webhook/reconciler replay from duplicating a notice.
    // createMany with skipDuplicates uses PostgreSQL ON CONFLICT DO NOTHING.
    const recipients = [...new Set(event.recipients)];
    if (!recipients.length) return;
    await transaction.client.notification.createMany({
      data: recipients.map(userId => ({
        userId, type: event.type, title: event.title, body: event.body,
        eventKey: `${event.key}:${userId}`,
      })),
      skipDuplicates: true,
    });
  }

  list(userId: string, page: number, limit: number, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }
  count(userId: string, unreadOnly: boolean) {
    return this.prisma.notification.count({ where: { userId, ...(unreadOnly ? { readAt: null } : {}) } });
  }
  async read(userId: string, id: string, at: Date) {
    return this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: at } });
  }
  findOwned(userId: string, id: string) { return this.prisma.notification.findFirst({ where: { id, userId } }); }
  async readAll(userId: string, at: Date) {
    return this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: at } });
  }
}
