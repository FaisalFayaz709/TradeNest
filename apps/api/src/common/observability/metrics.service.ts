import { Injectable } from '@nestjs/common';

const HTTP_DURATION_BUCKETS_MS = [25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000] as const;
const DEPENDENCY_DURATION_BUCKETS_MS = [25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000] as const;

export interface HistogramState {
  count: number;
  sumMs: number;
  bucketCounts: number[];
}

export interface HttpMetricState extends HistogramState {
  method: string;
  handler: string;
  statusCode: number;
}

export interface DependencyMetricState extends HistogramState {
  dependency: string;
  operation: string;
  outcome: string;
}

export interface HttpMetricSnapshot {
  inFlight: number;
  series: ReadonlyArray<HttpMetricState>;
}

export interface DependencyMetricSnapshot {
  series: ReadonlyArray<DependencyMetricState>;
}

export interface ObservabilitySnapshot {
  http: HttpMetricSnapshot;
  dependencies: DependencyMetricSnapshot;
}

@Injectable()
export class MetricsService {
  private inFlight = 0;
  private readonly http = new Map<string, HttpMetricState>();
  private readonly dependencies = new Map<string, DependencyMetricState>();

  beginHttpRequest(): void {
    this.inFlight += 1;
  }

  recordHttpRequest(method: string, handler: string, statusCode: number, durationMs: number): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const normalizedMethod = this.label(method, 'UNKNOWN', 16);
    const normalizedHandler = this.label(handler, 'UnknownHandler', 160);
    const normalizedStatus = Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599 ? statusCode : 500;
    const key = `${normalizedMethod}\u0000${normalizedHandler}\u0000${normalizedStatus}`;
    const state = this.http.get(key) ?? {
      method: normalizedMethod,
      handler: normalizedHandler,
      statusCode: normalizedStatus,
      count: 0,
      sumMs: 0,
      bucketCounts: HTTP_DURATION_BUCKETS_MS.map(() => 0),
    };
    this.observe(state, HTTP_DURATION_BUCKETS_MS, durationMs);
    this.http.set(key, state);
  }

  recordDependency(
    dependency: string,
    operation: string,
    outcome: 'success' | 'http_error' | 'timeout' | 'network_error' | 'invalid_response',
    durationMs: number,
  ): void {
    const normalizedDependency = this.label(dependency, 'unknown', 64);
    const normalizedOperation = this.label(operation, 'unknown', 96);
    const normalizedOutcome = this.label(outcome, 'unknown', 32);
    const key = `${normalizedDependency}\u0000${normalizedOperation}\u0000${normalizedOutcome}`;
    const state = this.dependencies.get(key) ?? {
      dependency: normalizedDependency,
      operation: normalizedOperation,
      outcome: normalizedOutcome,
      count: 0,
      sumMs: 0,
      bucketCounts: DEPENDENCY_DURATION_BUCKETS_MS.map(() => 0),
    };
    this.observe(state, DEPENDENCY_DURATION_BUCKETS_MS, durationMs);
    this.dependencies.set(key, state);
  }

  snapshot(): ObservabilitySnapshot {
    return {
      http: {
        inFlight: this.inFlight,
        series: [...this.http.values()].map((state) => ({ ...state, bucketCounts: [...state.bucketCounts] })),
      },
      dependencies: {
        series: [...this.dependencies.values()].map((state) => ({ ...state, bucketCounts: [...state.bucketCounts] })),
      },
    };
  }

  renderPrometheus(): string {
    const lines: string[] = [
      '# HELP tradenest_http_requests_in_flight Current in-flight TradeNest API requests.',
      '# TYPE tradenest_http_requests_in_flight gauge',
      `tradenest_http_requests_in_flight ${this.inFlight}`,
      '# HELP tradenest_http_requests_total Completed TradeNest API requests.',
      '# TYPE tradenest_http_requests_total counter',
    ];

    for (const state of this.http.values()) {
      const labels = `method="${this.escape(state.method)}",handler="${this.escape(state.handler)}",status="${state.statusCode}"`;
      lines.push(`tradenest_http_requests_total{${labels}} ${state.count}`);
    }

    lines.push(
      '# HELP tradenest_http_request_duration_seconds TradeNest API request duration.',
      '# TYPE tradenest_http_request_duration_seconds histogram',
    );
    for (const state of this.http.values()) {
      const baseLabels = `method="${this.escape(state.method)}",handler="${this.escape(state.handler)}",status="${state.statusCode}"`;
      for (let index = 0; index < HTTP_DURATION_BUCKETS_MS.length; index += 1) {
        lines.push(`tradenest_http_request_duration_seconds_bucket{${baseLabels},le="${HTTP_DURATION_BUCKETS_MS[index]! / 1_000}"} ${state.bucketCounts[index] ?? 0}`);
      }
      lines.push(`tradenest_http_request_duration_seconds_bucket{${baseLabels},le="+Inf"} ${state.count}`);
      lines.push(`tradenest_http_request_duration_seconds_sum{${baseLabels}} ${state.sumMs / 1_000}`);
      lines.push(`tradenest_http_request_duration_seconds_count{${baseLabels}} ${state.count}`);
    }

    lines.push(
      '# HELP tradenest_dependency_requests_total Outbound dependency calls made by the TradeNest API.',
      '# TYPE tradenest_dependency_requests_total counter',
    );
    for (const state of this.dependencies.values()) {
      const labels = `dependency="${this.escape(state.dependency)}",operation="${this.escape(state.operation)}",outcome="${this.escape(state.outcome)}"`;
      lines.push(`tradenest_dependency_requests_total{${labels}} ${state.count}`);
    }

    lines.push(
      '# HELP tradenest_dependency_request_duration_seconds Outbound dependency call duration.',
      '# TYPE tradenest_dependency_request_duration_seconds histogram',
    );
    for (const state of this.dependencies.values()) {
      const baseLabels = `dependency="${this.escape(state.dependency)}",operation="${this.escape(state.operation)}",outcome="${this.escape(state.outcome)}"`;
      for (let index = 0; index < DEPENDENCY_DURATION_BUCKETS_MS.length; index += 1) {
        lines.push(`tradenest_dependency_request_duration_seconds_bucket{${baseLabels},le="${DEPENDENCY_DURATION_BUCKETS_MS[index]! / 1_000}"} ${state.bucketCounts[index] ?? 0}`);
      }
      lines.push(`tradenest_dependency_request_duration_seconds_bucket{${baseLabels},le="+Inf"} ${state.count}`);
      lines.push(`tradenest_dependency_request_duration_seconds_sum{${baseLabels}} ${state.sumMs / 1_000}`);
      lines.push(`tradenest_dependency_request_duration_seconds_count{${baseLabels}} ${state.count}`);
    }

    const memory = process.memoryUsage();
    lines.push(
      '# HELP tradenest_process_uptime_seconds TradeNest API process uptime.',
      '# TYPE tradenest_process_uptime_seconds gauge',
      `tradenest_process_uptime_seconds ${process.uptime()}`,
      '# HELP tradenest_process_resident_memory_bytes TradeNest API resident memory.',
      '# TYPE tradenest_process_resident_memory_bytes gauge',
      `tradenest_process_resident_memory_bytes ${memory.rss}`,
      '# HELP tradenest_process_heap_used_bytes TradeNest API V8 heap currently in use.',
      '# TYPE tradenest_process_heap_used_bytes gauge',
      `tradenest_process_heap_used_bytes ${memory.heapUsed}`,
    );

    return `${lines.join('\n')}\n`;
  }

  private observe(state: HistogramState, buckets: readonly number[], rawDurationMs: number): void {
    const durationMs = Number.isFinite(rawDurationMs) && rawDurationMs >= 0 ? rawDurationMs : 0;
    state.count += 1;
    state.sumMs += durationMs;
    for (let index = 0; index < buckets.length; index += 1) {
      if (durationMs <= buckets[index]!) state.bucketCounts[index] = (state.bucketCounts[index] ?? 0) + 1;
    }
  }

  private label(value: string, fallback: string, maxLength: number): string {
    const normalized = String(value).trim();
    if (!normalized) return fallback;
    return normalized.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, maxLength) || fallback;
  }

  private escape(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
}

export const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';
