import { MetricsService } from '../../src/common/observability/index.js';

describe('MetricsService', () => {
  it('records bounded HTTP series and cumulative duration buckets', () => {
    const metrics = new MetricsService();
    metrics.beginHttpRequest();
    metrics.recordHttpRequest('GET', 'ProductsController.getBySlug', 200, 125);

    const snapshot = metrics.snapshot();
    expect(snapshot.http.inFlight).toBe(0);
    expect(snapshot.http.series).toHaveLength(1);
    expect(snapshot.http.series[0]).toMatchObject({
      method: 'GET',
      handler: 'ProductsController.getBySlug',
      statusCode: 200,
      count: 1,
      sumMs: 125,
    });

    const output = metrics.renderPrometheus();
    expect(output).toContain('tradenest_http_requests_total');
    expect(output).toContain('handler="ProductsController.getBySlug"');
    expect(output).toContain('tradenest_http_request_duration_seconds_bucket');
  });

  it('records downstream AI outcomes without request payload labels', () => {
    const metrics = new MetricsService();
    metrics.recordDependency('ai', 'fraud.score', 'timeout', 3_001);
    const output = metrics.renderPrometheus();

    expect(output).toContain('tradenest_dependency_requests_total');
    expect(output).toContain('dependency="ai"');
    expect(output).toContain('operation="fraud.score"');
    expect(output).toContain('outcome="timeout"');
    expect(output).not.toContain('userId');
    expect(output).not.toContain('paymentId');
  });
});
