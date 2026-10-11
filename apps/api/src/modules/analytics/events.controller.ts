import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  CreateBehaviorEventSchema,
  type CreateBehaviorEventInput,
} from '@tradenest/contracts/analytics';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit/index.js';
import {
  OptionalAccessTokenGuard,
  type AuthenticatedRequest,
} from '../auth/public/index.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('events')
@RateLimit('BEHAVIOR_EVENT_PRINCIPAL_OR_IP')
@UseGuards(OptionalAccessTokenGuard, RateLimitGuard)
export class EventsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateBehaviorEventSchema)) body: CreateBehaviorEventInput,
  ) {
    return { data: await this.analytics.ingestBehaviorEvent(request.auth, body) };
  }
}
