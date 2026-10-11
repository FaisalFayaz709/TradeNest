import { ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AddCartItemSchema, UpdateCartItemSchema, type AddCartItemInput, type UpdateCartItemInput } from '@tradenest/contracts/cart';
import { UuidSchema } from '@tradenest/contracts/common';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { CartService } from './cart.service.js';

@Controller('cart')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('BUYER')
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  async get(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.cart.getCart(principal) };
  }

  @Post('items')
  async addItem(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(AddCartItemSchema)) body: AddCartItemInput,
  ) {
    return { data: await this.cart.addItem(principal, body) };
  }

  @Patch('items/:itemId')
  async updateItem(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('itemId', new ZodValidationPipe(UuidSchema)) itemId: string,
    @Body(new ZodValidationPipe(UpdateCartItemSchema)) body: UpdateCartItemInput,
  ) {
    return { data: await this.cart.updateItem(principal, itemId, body) };
  }

  @Delete('items/:itemId')
  async deleteItem(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('itemId', new ZodValidationPipe(UuidSchema)) itemId: string,
  ) {
    return { data: await this.cart.deleteItem(principal, itemId) };
  }

  @Delete()
  async clear(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.cart.clearCart(principal) };
  }
}
