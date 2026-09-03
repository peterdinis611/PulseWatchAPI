import { parseK6Summary, deserializeSummary } from '../k6-summary';

describe('parseK6Summary', () => {
  it('reads request, latency and check metrics', () => {
    const summary = parseK6Summary(
      JSON.stringify({
        metrics: {
          http_reqs: { values: { count: 120, rate: 4 } },
          http_req_failed: { values: { rate: 0.01 } },
          http_req_duration: { values: { avg: 42.5, 'p(95)': 90 } },
          checks: { values: { passes: 118, fails: 2 } },
        },
      }),
    );

    expect(summary).toEqual({
      httpReqs: 120,
      failRate: 0.01,
      p95Ms: 90,
      avgMs: 42.5,
      checksPassed: 118,
      checksFailed: 2,
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parseK6Summary('not-json')).toBeNull();
    expect(parseK6Summary('{}')).toBeNull();
  });
});

describe('deserializeSummary', () => {
  it('returns null for empty input', () => {
    expect(deserializeSummary(null)).toBeNull();
    expect(deserializeSummary('nope')).toBeNull();
  });
});
