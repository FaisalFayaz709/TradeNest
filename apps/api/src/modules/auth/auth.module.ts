import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { OptionalAccessTokenGuard } from './optional-access-token.guard.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { AUTH_MODULE_API } from './public/module-api.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    PasswordService,
    RefreshTokenService,
    AccessTokenService,
    AuthService,
    AccessTokenGuard,
    OptionalAccessTokenGuard,
    { provide: AUTH_MODULE_API, useExisting: AuthService },
  ],
  exports: [AUTH_MODULE_API, AccessTokenGuard, OptionalAccessTokenGuard],
})
export class AuthModule {}
