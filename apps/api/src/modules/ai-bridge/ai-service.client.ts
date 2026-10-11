import { Injectable } from '@nestjs/common';
import { parseApiEnvironment } from '@tradenest/config';
import {
  FraudRiskScoreSchema,
  RecommendationSetSchema,
  SmartPricingSuggestionSchema,
  type FraudRiskScore,
  type RecommendationSet,
  type SmartPricingSuggestion,
} from '@tradenest/contracts/ai';
import { performance } from 'node:perf_hooks';
import { ApiException } from '../../common/http/api-exception.js';
import {
  MetricsService,
  ObservabilityContextService,
  OperationalLoggerService,
} from '../../common/observability/index.js';
import type { FraudRiskSignals, RecommendationBehaviorSignal, SmartPricingSignals } from '../analytics/public/module-api.js';
import type { RecommendationProductFeature, SmartPricingComparableProduct, SmartPricingProductContext } from '../catalog/public/module-api.js';

interface PersonalizedRecommendationRequest {
  events: RecommendationBehaviorSignal[];
  products: RecommendationProductFeature[];
  limit: number;
}

interface SmartPricingRequest {
  product: SmartPricingProductContext;
  comparables: SmartPricingComparableProduct[];
  signals: SmartPricingSignals;
}

interface SimilarRecommendationRequest {
  targetProductId: string;
  products: RecommendationProductFeature[];
  limit: number;
}

interface FraudRiskRequest {
  payment: {
    amount: string;
    currency: string;
    outcome: 'SUCCEEDED' | 'FAILED';
  };
  signals: FraudRiskSignals;
}

type DependencyOutcome = 'success' | 'http_error' | 'timeout' | 'network_error' | 'invalid_response';

@Injectable()
export class AiServiceClient {
  private readonly baseUrl = parseApiEnvironment(process.env).AI_SERVICE_URL.replace(/\/$/, '');
  private readonly timeoutMs = 3_000;

  constructor(
    private readonly observabilityContext: ObservabilityContextService,
    private readonly metrics: MetricsService,
    private readonly logger: OperationalLoggerService,
  ) {}

  personalized(input: PersonalizedRecommendationRequest): Promise<RecommendationSet> {
    return this.postRecommendation('/internal/recommendations/personalized', input);
  }

  similar(input: SimilarRecommendationRequest): Promise<RecommendationSet> {
    return this.postRecommendation('/internal/recommendations/similar', input);
  }

  smartPricing(input: SmartPricingRequest): Promise<SmartPricingSuggestion> {
    return this.postPricing('/internal/pricing/suggest', input);
  }

  fraudRisk(input: FraudRiskRequest): Promise<FraudRiskScore> {
    return this.postFraud('/internal/fraud/score', input);
  }

  private async postRecommendation(path: string, input: unknown): Promise<RecommendationSet> {
    const operation = path.endsWith('/personalized') ? 'recommendations.personalized' : 'recommendations.similar';
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let outcome: DependencyOutcome = 'network_error';
    let statusCode: number | undefined;
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      statusCode = response.status;
      if (!response.ok) {
        outcome = 'http_error';
        throw new ApiException(502, {
          code: 'AI_SERVICE_REQUEST_FAILED',
          message: 'The internal AI service rejected the recommendation request.',
          details: { status: response.status },
        });
      }
      const result = RecommendationSetSchema.safeParse(await response.json());
      if (!result.success) {
        outcome = 'invalid_response';
        throw new ApiException(502, {
          code: 'AI_SERVICE_INVALID_RESPONSE',
          message: 'The internal AI service returned an invalid recommendation response.',
        });
      }
      outcome = 'success';
      return result.data;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      outcome = controller.signal.aborted ? 'timeout' : 'network_error';
      throw new ApiException(503, {
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'The internal recommendation service is unavailable.',
      });
    } finally {
      clearTimeout(timeout);
      this.observeDependency(operation, outcome, startedAt, statusCode);
    }
  }

  private async postPricing(path: string, input: unknown): Promise<SmartPricingSuggestion> {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let outcome: DependencyOutcome = 'network_error';
    let statusCode: number | undefined;
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      statusCode = response.status;
      if (!response.ok) {
        outcome = 'http_error';
        throw new ApiException(502, {
          code: 'AI_SERVICE_REQUEST_FAILED',
          message: 'The internal AI service rejected the smart-pricing request.',
          details: { status: response.status },
        });
      }
      const result = SmartPricingSuggestionSchema.safeParse(await response.json());
      if (!result.success) {
        outcome = 'invalid_response';
        throw new ApiException(502, {
          code: 'AI_SERVICE_INVALID_RESPONSE',
          message: 'The internal AI service returned an invalid smart-pricing response.',
        });
      }
      outcome = 'success';
      return result.data;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      outcome = controller.signal.aborted ? 'timeout' : 'network_error';
      throw new ApiException(503, {
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'The internal smart-pricing service is unavailable.',
      });
    } finally {
      clearTimeout(timeout);
      this.observeDependency('pricing.suggest', outcome, startedAt, statusCode);
    }
  }

  private async postFraud(path: string, input: unknown): Promise<FraudRiskScore> {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let outcome: DependencyOutcome = 'network_error';
    let statusCode: number | undefined;
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      statusCode = response.status;
      if (!response.ok) {
        outcome = 'http_error';
        throw new ApiException(502, {
          code: 'AI_SERVICE_REQUEST_FAILED',
          message: 'The internal AI service rejected the fraud-risk request.',
          details: { status: response.status },
        });
      }
      const result = FraudRiskScoreSchema.safeParse(await response.json());
      if (!result.success) {
        outcome = 'invalid_response';
        throw new ApiException(502, {
          code: 'AI_SERVICE_INVALID_RESPONSE',
          message: 'The internal AI service returned an invalid fraud-risk response.',
        });
      }
      outcome = 'success';
      return result.data;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      outcome = controller.signal.aborted ? 'timeout' : 'network_error';
      throw new ApiException(503, {
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'The internal fraud-risk service is unavailable.',
      });
    } finally {
      clearTimeout(timeout);
      this.observeDependency('fraud.score', outcome, startedAt, statusCode);
    }
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const requestId = this.observabilityContext.requestId();
    if (requestId) headers['x-request-id'] = requestId;
    return headers;
  }

  private observeDependency(
    operation: string,
    outcome: DependencyOutcome,
    startedAt: number,
    statusCode?: number,
  ): void {
    const durationMs = Math.max(0, performance.now() - startedAt);
    this.metrics.recordDependency('ai', operation, outcome, durationMs);
    const fields = {
      requestId: this.observabilityContext.requestId(),
      dependency: 'tradenest-ai',
      operation,
      outcome,
      statusCode,
      durationMs: Number(durationMs.toFixed(3)),
    };
    if (outcome === 'success') this.logger.info('dependency.request.completed', fields);
    else this.logger.warn('dependency.request.completed', fields);
  }
}
