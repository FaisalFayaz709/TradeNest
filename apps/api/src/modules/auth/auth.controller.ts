import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ChangePasswordSchema,
  LoginSchema,
  RefreshSchema,
  RegisterSchema,
  type ChangePasswordInput,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from '@tradenest/contracts/auth';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit/index.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthService } from './auth.service.js';
import { CurrentPrincipal } from './current-principal.decorator.js';
import type { AuthPrincipal } from './public/module-api.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @RateLimit('AUTH_REGISTER_IP')
  @UseGuards(RateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) body: RegisterInput,
    @Req() request: Request,
  ) {
    return { data: await this.auth.register(body, this.metadata(request)) };
  }

  @Post('login')
  @RateLimit('AUTH_LOGIN_IP', 'AUTH_LOGIN_IDENTITY')
  @UseGuards(RateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Req() request: Request,
  ) {
    return { data: await this.auth.login(body, this.metadata(request)) };
  }

  @Post('refresh')
  @RateLimit('AUTH_REFRESH_IP')
  @UseGuards(RateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(RefreshSchema)) body: RefreshInput,
    @Req() request: Request,
  ) {
    return { data: await this.auth.refresh(body, this.metadata(request)) };
  }

  @Post('logout')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  async logout(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.auth.logout(principal) };
  }

  @Post('logout-all')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  async logoutAll(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.auth.logoutAll(principal) };
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  async me(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.auth.me(principal) };
  }

  @Post('change-password')
  @RateLimit('AUTH_CHANGE_PASSWORD_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  async changePassword(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) body: ChangePasswordInput,
  ) {
    return { data: await this.auth.changePassword(principal, body) };
  }

  private metadata(request: Request): { ipAddress?: string; userAgent?: string } {
    const ipAddress = request.ip || request.socket.remoteAddress || undefined;
    const userAgent = request.header('user-agent') || undefined;
    return {
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent: userAgent.slice(0, 2048) } : {}),
    };
  }
}
