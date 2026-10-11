import { ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@tradenest/contracts/products';
import { UuidSchema } from '@tradenest/contracts/common';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit/index.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { CatalogService } from './catalog.service.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  async list() {
    return { data: await this.catalog.listCategories() };
  }

  @Post()
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  @RequireRoles('ADMIN')
  @ApiBearerAuth()
  async create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(CreateCategorySchema)) body: CreateCategoryInput,
  ) {
    return { data: await this.catalog.createCategory(principal, body) };
  }

  @Patch(':id')
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  @RequireRoles('ADMIN')
  @ApiBearerAuth()
  async update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) body: UpdateCategoryInput,
  ) {
    return { data: await this.catalog.updateCategory(principal, id, body) };
  }
}
