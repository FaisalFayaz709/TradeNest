import { strict as assert } from 'node:assert';
import { MetricsService } from '../src/common/observability/metrics.service.js';
import { ObservabilityContextService } from '../src/common/observability/observability-context.service.js';

const metrics = new MetricsService();
metrics.beginHttpRequest();
metrics.recordHttpRequest('GET', 'HealthController.getHealth', 200, 12.5);
metrics.recordDependency('ai', 'recommendations.personalized', 'success', 45);

const exposition = metrics.renderPrometheus();
assert.match(exposition, /tradenest_http_requests_total/);
assert.match(exposition, /handler="HealthController.getHealth"/);
assert.match(exposition, /tradenest_dependency_requests_total/);
assert.equal(metrics.snapshot().http.inFlight, 0);

const context = new ObservabilityContextService();
const requestId = await context.run('req-observability-runtime', async () => {
  await Promise.resolve();
  return context.requestId();
});
assert.equal(requestId, 'req-observability-runtime');
assert.equal(context.requestId(), undefined);

console.log('the implementation OBSERVABILITY RUNTIME VERIFICATION PASSED');
