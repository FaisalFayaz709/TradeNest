import { ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UuidSchema } from '@tradenest/contracts/common';
import { CreateShipmentSchema, type CreateShipmentInput } from '@tradenest/contracts/shipping';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { ShippingService } from './shipping.service.js';

@Controller('orders')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('BUYER', 'SELLER')
@ApiBearerAuth()
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Post(':id/shipment')
  @RequireRoles('SELLER')
  async create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(CreateShipmentSchema)) body: CreateShipmentInput,
  ) {
    return { data: await this.shipping.createShipment(principal, id, body) };
  }

  @Get(':id/shipment')
  async get(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
  ) {
    return { data: await this.shipping.getShipment(principal, id) };
  }
}
