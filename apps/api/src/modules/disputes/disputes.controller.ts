import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { UuidSchema } from '@tradenest/contracts/common';
import { InitiateManagedUploadSchema, type InitiateManagedUploadInput } from '@tradenest/contracts/products';
import {
  AddDisputeEvidenceSchema,
  AddDisputeMessageSchema,
  OpenDisputeSchema,
  ResolveDisputeSchema,
  type AddDisputeEvidenceInput,
  type AddDisputeMessageInput,
  type OpenDisputeInput,
  type ResolveDisputeInput,
} from '@tradenest/contracts/disputes';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit/index.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { DisputesService } from './disputes.service.js';

@Controller()
@UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
@ApiBearerAuth()
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post('orders/:id/disputes')
  @RequireRoles('BUYER')
  async open(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) orderId: string,
    @Body(new ZodValidationPipe(OpenDisputeSchema)) body: OpenDisputeInput,
  ) {
    return { data: await this.disputes.open(principal, orderId, body) };
  }

  @Get('disputes/:id')
  @RequireRoles('BUYER', 'SELLER', 'ADMIN')
  async get(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
  ) {
    return { data: await this.disputes.get(principal, id) };
  }

  @Post('disputes/:id/messages')
  @RequireRoles('BUYER', 'SELLER', 'ADMIN')
  async addMessage(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(AddDisputeMessageSchema)) body: AddDisputeMessageInput,
  ) {
    return { data: await this.disputes.addMessage(principal, id, body) };
  }

  @Post('disputes/:id/evidence/upload-url')
  @RequireRoles('BUYER', 'SELLER')
  async prepareEvidenceUpload(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(InitiateManagedUploadSchema)) body: InitiateManagedUploadInput,
  ) {
    return { data: await this.disputes.prepareEvidenceUpload(principal, id, body) };
  }

  @Post('disputes/:id/evidence')
  @RequireRoles('BUYER', 'SELLER')
  async addEvidence(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(AddDisputeEvidenceSchema)) body: AddDisputeEvidenceInput,
  ) {
    return { data: await this.disputes.addEvidence(principal, id, body) };
  }

  @Post('admin/disputes/:id/resolve')
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @RequireRoles('ADMIN')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Stable retry key for dispute financial resolution.' })
  async resolve(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(ResolveDisputeSchema)) body: ResolveDisputeInput,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return { data: await this.disputes.resolve(principal, id, body, idempotencyKey, requestId), meta: { financialOutcome: body.resolution === 'REFUND_BUYER' ? 'PENDING_PROVIDER_CONFIRMATION' : 'FINALIZED' } };
  }
}
