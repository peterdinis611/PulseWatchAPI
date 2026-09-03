import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../logger/logger.service';
import { CacheService } from '../../cache/cache.service';
import { createTestCacheService } from '../../cache/__tests__/create-test-cache';
import { NotificationType } from '../../notification/notification-type';
import { NotificationService } from '../../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { K6RunnerService } from '../k6-runner.service';
import { StressTestExecutorService } from '../stress-test-executor.service';
import { StressTestStatus } from '../stress-test-status';

describe('StressTestExecutorService', () => {
  let executor: StressTestExecutorService;
  let findUnique: jest.Mock;
  let runUpdate: jest.Mock;
  let testUpdate: jest.Mock;
  let transaction: jest.Mock;
  let run: jest.Mock;
  let createForUser: jest.Mock;

  const testRow = {
    id: 'st-1',
    userId: 'user-1',
    name: 'Checkout load',
    url: 'https://example.com/checkout',
    method: 'GET',
    vus: 5,
    durationSec: 5,
    expectedStatus: 200,
    p95Ms: 300,
    maxFailRate: 0.01,
  };

  const runRow = {
    id: 'run-1',
    status: StressTestStatus.RUNNING,
    stressTest: testRow,
  };

  beforeEach(async () => {
    findUnique = jest.fn();
    runUpdate = jest.fn().mockResolvedValue({});
    testUpdate = jest.fn().mockResolvedValue({});
    transaction = jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops));
    run = jest.fn();
    createForUser = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StressTestExecutorService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: transaction,
            stressTestRun: { findUnique, update: runUpdate },
            stressTest: { update: testUpdate },
          },
        },
        {
          provide: K6RunnerService,
          useValue: { run },
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

  it('marks a zero-exit run as passed and notifies', async () => {
    findUnique.mockResolvedValue(runRow);
    run.mockResolvedValue({
      exitCode: 0,
      stderr: '',
      timedOut: false,
      summary: {
        httpReqs: 20,
        failRate: 0,
        p95Ms: 40,
        avgMs: 20,
        checksPassed: 20,
        checksFailed: 0,
      },
    });

    await executor.execute('run-1');

    expect(runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({ status: StressTestStatus.PASSED }),
      }),
    );
    expect(createForUser).toHaveBeenCalledWith('user-1', {
      type: NotificationType.SUCCESS,
      title: 'Checkout load passed',
      body: 'Checkout load finished within thresholds',
    });
  });

  it('marks a missing k6 binary as failed', async () => {
    findUnique.mockResolvedValue(runRow);
    run.mockRejectedValue(
      new Error('k6 is not installed. Install it from https://k6.io'),
    );

    await executor.execute('run-1');

    expect(runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StressTestStatus.FAILED,
          error: 'k6 is not installed. Install it from https://k6.io',
        }),
      }),
    );
    expect(createForUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ type: NotificationType.ALERT }),
    );
  });

  it('ignores runs that are not RUNNING', async () => {
    findUnique.mockResolvedValue({
      ...runRow,
      status: StressTestStatus.PASSED,
    });

    await executor.execute('run-1');

    expect(run).not.toHaveBeenCalled();
  });
});
