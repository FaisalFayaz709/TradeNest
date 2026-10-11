import { ObservabilityContextService } from '../../src/common/observability/index.js';

describe('ObservabilityContextService', () => {
  it('keeps request correlation across asynchronous work without global mutable state', async () => {
    const context = new ObservabilityContextService();
    const observed = await context.run('req-observability', async () => {
      await Promise.resolve();
      return context.requestId();
    });

    expect(observed).toBe('req-observability');
    expect(context.requestId()).toBeUndefined();
  });
});
