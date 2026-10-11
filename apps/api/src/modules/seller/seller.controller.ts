import { ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  OnboardSellerSchema,
  UpdateSellerProfileSchema,
  type OnboardSellerInput,
  type UpdateSellerProfileInput,
} from '@tradenest/contracts/seller';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { SellerService } from './seller.service.js';

@Controller('seller')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('SELLER')
@ApiBearerAuth()
export class SellerController {
  constructor(private readonly sellers: SellerService) {}

  @Post('onboard')
  async onboard(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(OnboardSellerSchema)) body: OnboardSellerInput,
  ) {
    return { data: await this.sellers.onboard(principal, body) };
  }

  @Get('profile')
  async profile(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.sellers.profile(principal) };
  }

  @Patch('profile')
  async updateProfile(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(UpdateSellerProfileSchema)) body: UpdateSellerProfileInput,
  ) {
    return { data: await this.sellers.updateProfile(principal, body) };
  }

  @Get('dashboard')
  async dashboard(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.sellers.dashboard(principal) };
  }
}
