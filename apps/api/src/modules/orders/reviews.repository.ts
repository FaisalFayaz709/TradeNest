import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByProduct(productId: string, page: number, limit: number) {
    const where = { productId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { rows, total };
  }

  findByOrderItem(orderItemId: string) {
    return this.prisma.review.findUnique({ where: { orderItemId } });
  }

  create(input: { orderItemId: string; buyerId: string; productId: string; rating: number; comment: string | null }) {
    return this.prisma.review.create({ data: input });
  }
}
