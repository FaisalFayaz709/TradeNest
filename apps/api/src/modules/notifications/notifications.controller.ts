import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { UuidSchema } from '@tradenest/contracts/common';
import { NotificationsQuerySchema, type NotificationsQuery } from '@tradenest/contracts/notifications';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('BUYER', 'SELLER', 'ADMIN')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get()
  async list(@CurrentPrincipal() principal: AuthPrincipal, @Query(new ZodValidationPipe(NotificationsQuerySchema)) query: NotificationsQuery) {
    return this.notifications.list(principal, query);
  }
  @Get('unread-count')
  async unread(@CurrentPrincipal() principal: AuthPrincipal) { return { data: await this.notifications.unread(principal) }; }
  @Patch('read-all')
  async readAll(@CurrentPrincipal() principal: AuthPrincipal) { return { data: await this.notifications.markAllRead(principal) }; }
  @Patch(':id/read')
  async read(@CurrentPrincipal() principal: AuthPrincipal, @Param('id', new ZodValidationPipe(UuidSchema)) id: string) {
    return { data: await this.notifications.markRead(principal, id) };
  }
}
