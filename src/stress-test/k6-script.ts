import { STRESS_TEST_USER_AGENT } from './stress-test.constants';

export type K6ScriptOptions = {
  url: string;
  method: string;
  vus: number;
  durationSec: number;
  expectedStatus: number;
  p95Ms?: number | null;
  maxFailRate?: number | null;
};

export function generateK6Script(options: K6ScriptOptions): string {
  const thresholds: Record<string, string[]> = {
    checks: ['rate==1'],
  };

  if (options.maxFailRate != null) {
    thresholds.http_req_failed = [`rate<${options.maxFailRate}`];
  }
  if (options.p95Ms != null) {
    thresholds.http_req_duration = [`p(95)<${options.p95Ms}`];
  }

  return `import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: ${JSON.stringify(options.vus)},
  duration: ${JSON.stringify(`${options.durationSec}s`)},
  thresholds: ${JSON.stringify(thresholds)},
};

export default function () {
  const res = http.request(
    ${JSON.stringify(options.method)},
    ${JSON.stringify(options.url)},
    null,
    { headers: { 'User-Agent': ${JSON.stringify(STRESS_TEST_USER_AGENT)} } },
  );
  check(res, {
    'status matches': (r) => r.status === ${JSON.stringify(options.expectedStatus)},
  });
}
`;
}
