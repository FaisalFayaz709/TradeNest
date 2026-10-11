import { Injectable } from '@nestjs/common';
import {
  CreateReviewSchema,
  ReviewListQuerySchema,
  ReviewSchema,
  type CreateReviewInput,
  type Review,
  type ReviewListQuery,
} from '@tradenest/contracts/reviews';
import { AuthorizationService } from '../../common/authorization/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { OrdersRepository } from './orders.repository.js';
import { ReviewsRepository } from './reviews.repository.js';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviews: ReviewsRepository,
    private readonly orders: OrdersRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  async listProductReviews(productId: string, raw: ReviewListQuery) {
    const query = ReviewListQuerySchema.parse(raw);
    const result = await this.reviews.listByProduct(productId, query.page, query.limit);
    return {
      data: result.rows.map((row) => this.map(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  async create(principal: AuthPrincipal, orderId: string, raw: CreateReviewInput): Promise<Review> {
    this.authorization.requireRole(principal, ['BUYER']);
    const input = CreateReviewSchema.parse(raw);
    const purchase = await this.orders.findReviewPurchaseContext(orderId, input.orderItemId);
    if (!purchase || purchase.buyerId !== principal.userId) throw this.purchaseNotFound();
    if (purchase.status !== 'COMPLETED') {
      throw new ApiException(409, {
        code: 'REVIEW_NOT_ELIGIBLE',
        message: 'Only a completed purchased order item can be reviewed.',
        details: { orderId, orderItemId: input.orderItemId, orderStatus: purchase.status },
      });
    }
    if (await this.reviews.findByOrderItem(input.orderItemId)) throw this.alreadyExists(input.orderItemId);

    try {
      const row = await this.reviews.create({
        orderItemId: input.orderItemId,
        buyerId: principal.userId,
        productId: purchase.productId,
        rating: input.rating,
        comment: input.comment?.length ? input.comment : null,
      });
      return this.map(row);
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2002')) throw this.alreadyExists(input.orderItemId);
      throw error;
    }
  }

  private map(row: { id: string; productId: string; rating: number; comment: string | null; createdAt: Date; updatedAt: Date }): Review {
    return ReviewSchema.parse({
      id: row.id,
      productId: row.productId,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  private purchaseNotFound(): ApiException {
    return new ApiException(404, {
      code: 'ORDER_ITEM_NOT_FOUND',
      message: 'The requested purchased order item was not found.',
    });
  }

  private alreadyExists(orderItemId: string): ApiException {
    return new ApiException(409, {
      code: 'REVIEW_ALREADY_EXISTS',
      message: 'This purchased order item has already been reviewed.',
      details: { orderItemId },
    });
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
  }
}
