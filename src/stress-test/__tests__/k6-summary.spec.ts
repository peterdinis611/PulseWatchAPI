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

  it('reads k6 v2 flat metrics', () => {
    const summary = parseK6Summary(
      JSON.stringify({
        metrics: {
          http_reqs: { count: 8777, rate: 8775 },
          http_req_failed: { passes: 0, fails: 8777, value: 0 },
          http_req_duration: { avg: 0.059, 'p(95)': 0.074 },
          checks: { passes: 8777, fails: 0, value: 1 },
        },
      }),
    );

    expect(summary).toEqual({
      httpReqs: 8777,
      failRate: 0,
      p95Ms: 0.074,
      avgMs: 0.059,
      checksPassed: 8777,
      checksFailed: 0,
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parseK6Summary('not-json')).toBeNull();
    expect(parseK6Summary('{}')).toBeNull();
  });

  it('uses rate from v1 and value from v2 for failRate', () => {
    expect(
      parseK6Summary(
        JSON.stringify({
          metrics: {
            http_reqs: { count: 10 },
            http_req_failed: { rate: 0.25 },
            http_req_duration: {},
            checks: {},
          },
        }),
      )?.failRate,
    ).toBe(0.25);
  });
});

describe('deserializeSummary', () => {
  it('returns null for empty input', () => {
    expect(deserializeSummary(null)).toBeNull();
    expect(deserializeSummary('nope')).toBeNull();
  });
});
