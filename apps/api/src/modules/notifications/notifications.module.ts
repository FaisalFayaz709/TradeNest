import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/public/index.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';
import { NOTIFICATIONS_MODULE_API } from './public/module-api.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotificationsService, { provide: NOTIFICATIONS_MODULE_API, useExisting: NotificationsService }],
  exports: [NOTIFICATIONS_MODULE_API],
})
export class NotificationsModule {}
