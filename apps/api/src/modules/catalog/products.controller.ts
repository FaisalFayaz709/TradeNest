import { ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ProductSlugSchema, UuidSchema } from '@tradenest/contracts/common';
import {
  AddProductImageSchema,
  InitiateManagedUploadSchema,
  CreateProductSchema,
  ProductQuerySchema,
  UpdateInventorySchema,
  UpdateProductSchema,
  type AddProductImageInput,
  type InitiateManagedUploadInput,
  type CreateProductInput,
  type ProductQuery,
  type UpdateInventoryInput,
  type UpdateProductInput,
} from '@tradenest/contracts/products';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit/index.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { CatalogService } from './catalog.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(ProductQuerySchema)) query: ProductQuery) {
    return this.catalog.listPublicProducts(query);
  }

  @Get(':slug')
  async detail(@Param('slug', new ZodValidationPipe(ProductSlugSchema)) slug: string) {
    return { data: await this.catalog.productBySlug(slug) };
  }

  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @RequireRoles('SELLER')
  @ApiBearerAuth()
  async create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(CreateProductSchema)) body: CreateProductInput,
  ) {
    return { data: await this.catalog.createProduct(principal, body) };
  }

  @Patch(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @RequireRoles('SELLER')
  @ApiBearerAuth()
  async update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) body: UpdateProductInput,
  ) {
    return { data: await this.catalog.updateProduct(principal, id, body) };
  }

  @Delete(':id')
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  @RequireRoles('SELLER', 'ADMIN')
  @ApiBearerAuth()
  async remove(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
  ) {
    return { data: await this.catalog.deleteProduct(principal, id) };
  }

  @Get(':id/images/:imageId/file')
  async publicImage(
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Param('imageId', new ZodValidationPipe(UuidSchema)) imageId: string,
    @Res() response: Response,
  ) {
    const file = await this.catalog.publicProductImage(id, imageId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'public, max-age=3600');
    response.send(Buffer.from(file.bytes));
  }

  @Post(':id/images/upload-url')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @RequireRoles('SELLER')
  @ApiBearerAuth()
  async prepareImageUpload(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(InitiateManagedUploadSchema)) body: InitiateManagedUploadInput,
  ) {
    return { data: await this.catalog.prepareImageUpload(principal, id, body) };
  }

  @Post(':id/images')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @RequireRoles('SELLER')
  @ApiBearerAuth()
  async addImage(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(AddProductImageSchema)) body: AddProductImageInput,
  ) {
    return { data: await this.catalog.addProductImage(principal, id, body) };
  }

  @Patch(':id/inventory')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @RequireRoles('SELLER')
  @ApiBearerAuth()
  async updateInventory(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(UpdateInventorySchema)) body: UpdateInventoryInput,
  ) {
    return { data: await this.catalog.updateInventory(principal, id, body) };
  }

  @Post(':id/publish')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @RequireRoles('SELLER')
  @ApiBearerAuth()
  async publish(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
  ) {
    return { data: await this.catalog.publishProduct(principal, id) };
  }

  @Post(':id/archive')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @RequireRoles('SELLER')
  @ApiBearerAuth()
  async archive(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
  ) {
    return { data: await this.catalog.archiveProduct(principal, id) };
  }
}
