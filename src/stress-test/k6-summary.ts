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
  value?: number;
  avg?: number;
  'p(95)'?: number;
  passes?: number;
  fails?: number;
};

type K6SummaryFile = {
  metrics?: Record<string, unknown>;
};

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function metricValues(metric: unknown): K6MetricValues | null {
  if (!metric || typeof metric !== 'object' || Array.isArray(metric)) {
    return null;
  }

  const record = metric as { values?: unknown };
  if (record.values && typeof record.values === 'object') {
    return record.values as K6MetricValues;
  }

  return record as K6MetricValues;
}

export function parseK6Summary(raw: string): StressTestSummaryValue | null {
  try {
    const parsed = JSON.parse(raw) as K6SummaryFile;
    const metrics = parsed.metrics;
    if (!metrics || typeof metrics !== 'object') {
      return null;
    }

    const httpReqs = metricValues(metrics.http_reqs);
    const failed = metricValues(metrics.http_req_failed);
    const duration = metricValues(metrics.http_req_duration);
    const checks = metricValues(metrics.checks);

    return {
      httpReqs: numeric(httpReqs?.count),
      failRate: numeric(failed?.rate) ?? numeric(failed?.value),
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
