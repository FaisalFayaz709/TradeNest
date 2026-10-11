import { ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UuidSchema } from '@tradenest/contracts/common';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { WishlistService } from './wishlist.service.js';

@Controller('wishlist')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('BUYER')
@ApiBearerAuth()
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  async list(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.wishlist.list(principal) };
  }

  @Post(':productId')
  async add(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('productId', new ZodValidationPipe(UuidSchema)) productId: string,
  ) {
    return { data: await this.wishlist.add(principal, productId) };
  }

  @Delete(':productId')
  async remove(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('productId', new ZodValidationPipe(UuidSchema)) productId: string,
  ) {
    return { data: await this.wishlist.remove(principal, productId) };
  }
}
