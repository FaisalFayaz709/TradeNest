import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateAddressSchema,
  UpdateAddressSchema,
  UpdateUserProfileSchema,
  type CreateAddressInput,
  type UpdateAddressInput,
  type UpdateUserProfileInput,
} from '@tradenest/contracts/users';
import { UuidSchema } from '@tradenest/contracts/common';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { UsersService } from './users.service.js';

@Controller('users/me')
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.users.me(principal) };
  }

  @Patch()
  async updateMe(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(UpdateUserProfileSchema)) body: UpdateUserProfileInput,
  ) {
    return { data: await this.users.updateMe(principal, body) };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteMe(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.users.deleteMe(principal) };
  }

  @Get('addresses')
  async listAddresses(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.users.listAddresses(principal) };
  }

  @Post('addresses')
  @HttpCode(HttpStatus.CREATED)
  async createAddress(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(CreateAddressSchema)) body: CreateAddressInput,
  ) {
    return { data: await this.users.createAddress(principal, body) };
  }

  @Patch('addresses/:addressId')
  async updateAddress(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('addressId', new ZodValidationPipe(UuidSchema)) addressId: string,
    @Body(new ZodValidationPipe(UpdateAddressSchema)) body: UpdateAddressInput,
  ) {
    return { data: await this.users.updateAddress(principal, addressId, body) };
  }

  @Delete('addresses/:addressId')
  @HttpCode(HttpStatus.OK)
  async deleteAddress(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('addressId', new ZodValidationPipe(UuidSchema)) addressId: string,
  ) {
    return { data: await this.users.deleteAddress(principal, addressId) };
  }
}
