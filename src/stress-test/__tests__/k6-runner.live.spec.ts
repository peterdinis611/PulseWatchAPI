import { createServer, type IncomingMessage, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { generateK6Script } from '../k6-script';
import { K6RunnerService } from '../k6-runner.service';
import { k6TimeoutMs, STRESS_TEST_USER_AGENT } from '../stress-test.constants';
import { k6Available } from './k6-available';

const describeK6 = k6Available() ? describe : describe.skip;

type RecordedRequest = {
  method: string;
  url: string;
  userAgent: string | undefined;
};

describeK6('K6RunnerService (live k6 load)', () => {
  let server: Server;
  let origin: string;
  const requests: RecordedRequest[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      requests.push({
        method: req.method ?? '',
        url: req.url ?? '/',
        userAgent: header(req, 'user-agent'),
      });

      const path = req.url ?? '/';
      if (path.startsWith('/slow')) {
        setTimeout(() => {
          res.writeHead(200);
          res.end('slow');
        }, 80);
        return;
      }
      if (path.startsWith('/fail')) {
        res.writeHead(500);
        res.end('fail');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    requests.length = 0;
  });

  function runner(): K6RunnerService {
    return new K6RunnerService({
      get: () => undefined,
    } as unknown as ConfigService);
  }

  function script(
    path: string,
    overrides: Partial<Parameters<typeof generateK6Script>[0]> = {},
  ) {
    return generateK6Script({
      url: `${origin}${path}`,
      method: 'GET',
      vus: 1,
      durationSec: 1,
      expectedStatus: 200,
      ...overrides,
    });
  }

  it('runs a generated script and parses the k6 summary', async () => {
    const result = await runner().run(
      script('/ok', { p95Ms: 5_000, maxFailRate: 0.1 }),
      k6TimeoutMs(1),
    );

    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.summary?.httpReqs).toBeGreaterThan(0);
    expect(result.summary?.failRate).toBe(0);
    expect(result.summary?.checksPassed).toBeGreaterThan(0);
    expect(result.summary?.checksFailed).toBe(0);
    expect(result.summary?.p95Ms).toEqual(expect.any(Number));
    expect(result.summary?.avgMs).toEqual(expect.any(Number));
  }, 20_000);

  it('drives multiple VUs harder than a single VU', async () => {
    const single = await runner().run(
      script('/ok', { vus: 1 }),
      k6TimeoutMs(1),
    );
    const multi = await runner().run(script('/ok', { vus: 5 }), k6TimeoutMs(1));

    expect(single.exitCode).toBe(0);
    expect(multi.exitCode).toBe(0);
    expect(multi.summary?.httpReqs ?? 0).toBeGreaterThan(
      single.summary?.httpReqs ?? 0,
    );
  }, 30_000);

  it('sends POST with the PulseWatch user-agent', async () => {
    const result = await runner().run(
      script('/ok', { method: 'POST' }),
      k6TimeoutMs(1),
    );

    expect(result.exitCode).toBe(0);
    expect(requests.some((req) => req.method === 'POST')).toBe(true);
    expect(
      requests.some((req) => req.userAgent === STRESS_TEST_USER_AGENT),
    ).toBe(true);
  }, 20_000);

  it('sends HEAD and PUT requests', async () => {
    const head = await runner().run(
      script('/ok', { method: 'HEAD' }),
      k6TimeoutMs(1),
    );
    const put = await runner().run(
      script('/ok', { method: 'PUT' }),
      k6TimeoutMs(1),
    );

    expect(head.exitCode).toBe(0);
    expect(put.exitCode).toBe(0);
    expect(requests.some((req) => req.method === 'HEAD')).toBe(true);
    expect(requests.some((req) => req.method === 'PUT')).toBe(true);
  }, 30_000);

  it('fails when the expected status does not match', async () => {
    const result = await runner().run(
      script('/ok', { expectedStatus: 201 }),
      k6TimeoutMs(1),
    );

    expect(result.timedOut).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.summary?.checksFailed).toBeGreaterThan(0);
  }, 20_000);

  it('fails the p95 threshold on a slow endpoint', async () => {
    const result = await runner().run(
      script('/slow', { p95Ms: 1 }),
      k6TimeoutMs(1),
    );

    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(99);
    expect(result.summary?.p95Ms ?? 0).toBeGreaterThan(1);
  }, 20_000);

  it('fails maxFailRate when the target returns 500', async () => {
    const result = await runner().run(
      script('/fail', { expectedStatus: 200, maxFailRate: 0.01 }),
      k6TimeoutMs(1),
    );

    expect(result.timedOut).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.summary?.failRate ?? 0).toBeGreaterThan(0.01);
  }, 20_000);

  it('kills k6 when the runner timeout elapses', async () => {
    const result = await runner().run(script('/ok', { durationSec: 30 }), 400);

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  }, 10_000);
});

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
