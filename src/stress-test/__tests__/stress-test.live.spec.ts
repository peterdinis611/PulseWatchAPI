import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../logger/logger.service';
import { CacheService } from '../../cache/cache.service';
import { createTestCacheService } from '../../cache/__tests__/create-test-cache';
import { NotificationType } from '../../notification/notification-type';
import { NotificationService } from '../../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { K6RunnerService } from '../k6-runner.service';
import { StressTestExecutorService } from '../stress-test-executor.service';
import { StressTestStatus } from '../stress-test-status';
import { k6Available } from './k6-available';

const describeK6 = k6Available() ? describe : describe.skip;

describeK6('StressTestExecutorService (live k6)', () => {
  let server: Server;
  let origin: string;
  let executor: StressTestExecutorService;
  let findUnique: jest.Mock;
  let runUpdate: jest.Mock;
  let testUpdate: jest.Mock;
  let createForUser: jest.Mock;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      const path = _req.url ?? '/';
      if (path.startsWith('/down')) {
        res.writeHead(503);
        res.end('unavailable');
        return;
      }
      res.writeHead(200);
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

  beforeEach(async () => {
    findUnique = jest.fn();
    runUpdate = jest.fn().mockResolvedValue({});
    testUpdate = jest.fn().mockResolvedValue({});
    createForUser = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StressTestExecutorService,
        K6RunnerService,
        {
          provide: ConfigService,
          useValue: { get: () => undefined },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(async (ops: Promise<unknown>[]) =>
              Promise.all(ops),
            ),
            stressTestRun: { findUnique, update: runUpdate },
            stressTest: { update: testUpdate },
          },
        },
        {
          provide: NotificationService,
          useValue: { createForUser },
        },
        {
          provide: CacheService,
          useValue: createTestCacheService(),
        },
        {
          provide: LoggerService,
          useValue: { debug: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    executor = module.get(StressTestExecutorService);
  });

  function runRow(path: string, overrides: Record<string, unknown> = {}) {
    return {
      id: 'run-1',
      status: StressTestStatus.RUNNING,
      stressTest: {
        id: 'st-1',
        userId: 'user-1',
        name: 'Live load',
        url: `${origin}${path}`,
        method: 'GET',
        vus: 2,
        durationSec: 1,
        expectedStatus: 200,
        p95Ms: 5_000,
        maxFailRate: 0.05,
        ...overrides,
      },
    };
  }

  it('passes a live 2-VU load against a local endpoint', async () => {
    findUnique.mockResolvedValue(runRow('/ok'));

    await executor.execute('run-1');

    expect(runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StressTestStatus.PASSED,
          error: null,
          summary: expect.stringContaining('"httpReqs":'),
        }),
      }),
    );
    expect(createForUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ type: NotificationType.SUCCESS }),
    );
  }, 20_000);

  it('fails a live load when the target is down', async () => {
    findUnique.mockResolvedValue(runRow('/down'));

    await executor.execute('run-1');

    expect(runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StressTestStatus.FAILED,
        }),
      }),
    );
    expect(createForUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ type: NotificationType.ALERT }),
    );
  }, 20_000);
});
