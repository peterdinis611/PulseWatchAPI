import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { spawnSync } from 'node:child_process';
import { ConfigService } from '@nestjs/config';
import { generateK6Script } from '../k6-script';
import { K6RunnerService } from '../k6-runner.service';
import { k6TimeoutMs } from '../stress-test.constants';

function k6Available(): boolean {
  try {
    const result = spawnSync('k6', ['version'], { encoding: 'utf8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

const describeK6 = k6Available() ? describe : describe.skip;

describeK6('K6RunnerService (live k6 binary)', () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}/`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function runner(): K6RunnerService {
    return new K6RunnerService({
      get: () => undefined,
    } as unknown as ConfigService);
  }

  it('runs a generated script and parses the k6 summary', async () => {
    const script = generateK6Script({
      url,
      method: 'GET',
      vus: 1,
      durationSec: 1,
      expectedStatus: 200,
      p95Ms: 5_000,
      maxFailRate: 0.1,
    });

    const result = await runner().run(script, k6TimeoutMs(1));

    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.summary?.httpReqs).toBeGreaterThan(0);
    expect(result.summary?.failRate).toBe(0);
    expect(result.summary?.checksPassed).toBeGreaterThan(0);
    expect(result.summary?.checksFailed).toBe(0);
    expect(result.summary?.p95Ms).toEqual(expect.any(Number));
    expect(result.summary?.avgMs).toEqual(expect.any(Number));
  }, 20_000);

  it('fails when the expected status does not match', async () => {
    const script = generateK6Script({
      url,
      method: 'GET',
      vus: 1,
      durationSec: 1,
      expectedStatus: 201,
    });

    const result = await runner().run(script, k6TimeoutMs(1));

    expect(result.timedOut).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.summary?.checksFailed).toBeGreaterThan(0);
  }, 20_000);
});
