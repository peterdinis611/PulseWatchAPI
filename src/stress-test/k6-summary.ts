export type StressTestSummaryValue = {
  httpReqs: number | null;
  failRate: number | null;
  p95Ms: number | null;
  avgMs: number | null;
  checksPassed: number | null;
  checksFailed: number | null;
};

type K6MetricValues = {
  count?: number;
  rate?: number;
  avg?: number;
  'p(95)'?: number;
  passes?: number;
  fails?: number;
};

type K6SummaryFile = {
  metrics?: Record<string, { values?: K6MetricValues } | undefined>;
};

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseK6Summary(raw: string): StressTestSummaryValue | null {
  try {
    const parsed = JSON.parse(raw) as K6SummaryFile;
    const metrics = parsed.metrics;
    if (!metrics || typeof metrics !== 'object') {
      return null;
    }

    const httpReqs = metrics.http_reqs?.values;
    const failed = metrics.http_req_failed?.values;
    const duration = metrics.http_req_duration?.values;
    const checks = metrics.checks?.values;

    return {
      httpReqs: numeric(httpReqs?.count),
      failRate: numeric(failed?.rate),
      p95Ms: numeric(duration?.['p(95)']),
      avgMs: numeric(duration?.avg),
      checksPassed: numeric(checks?.passes),
      checksFailed: numeric(checks?.fails),
    };
  } catch {
    return null;
  }
}

export function serializeSummary(
  summary: StressTestSummaryValue | null,
): string | null {
  return summary ? JSON.stringify(summary) : null;
}

export function deserializeSummary(
  raw: string | null,
): StressTestSummaryValue | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StressTestSummaryValue;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
