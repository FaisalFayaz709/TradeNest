import { ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UuidSchema } from '@tradenest/contracts/common';
import {
  CreateReviewSchema,
  ReviewListQuerySchema,
  type CreateReviewInput,
  type ReviewListQuery,
} from '@tradenest/contracts/reviews';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { ReviewsService } from './reviews.service.js';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('products/:id/reviews')
  async list(
    @Param('id', new ZodValidationPipe(UuidSchema)) productId: string,
    @Query(new ZodValidationPipe(ReviewListQuerySchema)) query: ReviewListQuery,
  ) {
    return this.reviews.listProductReviews(productId, query);
  }

  @Post('orders/:orderId/reviews')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @RequireRoles('BUYER')
  @ApiBearerAuth()
  async create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('orderId', new ZodValidationPipe(UuidSchema)) orderId: string,
    @Body(new ZodValidationPipe(CreateReviewSchema)) body: CreateReviewInput,
  ) {
    return { data: await this.reviews.create(principal, orderId, body) };
  }
}
