import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { createTestCacheService } from '../../cache/__tests__/create-test-cache';
import { JobsService } from '../../jobs/jobs.service';
import { createTestJobsService } from '../../jobs/__tests__/create-test-jobs';
import { LoggerService } from '../../logger/logger.service';
import { StressTestExecutorService } from '../stress-test-executor.service';
import { StressTestService } from '../stress-test.service';
import { StressTestStatus } from '../stress-test-status';

describe('StressTestService', () => {
  let service: StressTestService;
  let findMany: jest.Mock;
  let findFirst: jest.Mock;
  let create: jest.Mock;
  let update: jest.Mock;
  let deleteMany: jest.Mock;
  let runFindFirst: jest.Mock;
  let runCreate: jest.Mock;
  let runFindMany: jest.Mock;
  let execute: jest.Mock;
  let jobs: ReturnType<typeof createTestJobsService>;

  const row = {
    id: 'st-1',
    userId: 'user-1',
    name: 'API load',
    url: 'https://example.com/health',
    method: 'GET',
    vus: 10,
    durationSec: 30,
    expectedStatus: 200,
    p95Ms: null,
    maxFailRate: null,
    lastStatus: StressTestStatus.IDLE,
    lastError: null,
    lastSummary: null,
    lastRunAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    findMany = jest.fn();
    findFirst = jest.fn();
    create = jest.fn();
    update = jest.fn();
    deleteMany = jest.fn();
    runFindFirst = jest.fn();
    runCreate = jest.fn();
    runFindMany = jest.fn();
    execute = jest.fn().mockResolvedValue(undefined);
    jobs = createTestJobsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StressTestService,
        {
          provide: PrismaService,
          useValue: {
            stressTest: { findMany, findFirst, create, update, deleteMany },
            stressTestRun: {
              findFirst: runFindFirst,
              create: runCreate,
              findMany: runFindMany,
            },
          },
        },
        {
          provide: CacheService,
          useValue: createTestCacheService(),
        },
        {
          provide: JobsService,
          useValue: jobs,
        },
        {
          provide: StressTestExecutorService,
          useValue: { execute },
        },
        {
          provide: LoggerService,
          useValue: { warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(StressTestService);
  });

  it('creates a stress test', async () => {
    create.mockResolvedValue(row);

    await expect(
      service.createForUser('user-1', {
        name: ' API load ',
        url: 'https://example.com/health',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'st-1',
        name: 'API load',
        url: 'https://example.com/health',
        method: 'GET',
        lastStatus: StressTestStatus.IDLE,
      }),
    );
  });

  it('updates an owned test and lists runs', async () => {
    findFirst.mockResolvedValue(row);
    update.mockResolvedValue({
      ...row,
      name: 'API load v2',
      method: 'POST',
      p95Ms: 200,
    });
    runFindMany.mockResolvedValue([
      {
        id: 'run-1',
        stressTestId: 'st-1',
        status: StressTestStatus.PASSED,
        error: null,
        summary: JSON.stringify({
          httpReqs: 40,
          failRate: 0,
          p95Ms: 12,
          avgMs: 8,
          checksPassed: 40,
          checksFailed: 0,
        }),
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        finishedAt: new Date('2026-01-01T00:00:30.000Z'),
      },
    ]);

    await expect(
      service.updateForUser('user-1', 'st-1', {
        name: 'API load v2',
        method: 'POST',
        p95Ms: 200,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        name: 'API load v2',
        method: 'POST',
        p95Ms: 200,
      }),
    );
    await expect(service.listRunsForUser('user-1', 'st-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'run-1',
        status: StressTestStatus.PASSED,
        summary: expect.objectContaining({ httpReqs: 40 }),
      }),
    ]);
  });

  it('falls back in-process when enqueue throws', async () => {
    findFirst.mockResolvedValueOnce(row).mockResolvedValue({
      ...row,
      lastStatus: StressTestStatus.RUNNING,
    });
    runFindFirst.mockResolvedValue(null);
    runCreate.mockResolvedValue({ id: 'run-1' });
    update.mockResolvedValue({
      ...row,
      lastStatus: StressTestStatus.RUNNING,
    });
    jobs.enqueueStressTestRun.mockRejectedValue(new Error('redis down'));

    await service.runForUser('user-1', 'st-1');

    expect(execute).toHaveBeenCalledWith('run-1');
  });

  it('rejects a non-http URL', async () => {
    await expect(
      service.createForUser('user-1', {
        name: 'Bad',
        url: 'ftp://example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unsupported HTTP method', async () => {
    await expect(
      service.createForUser('user-1', {
        name: 'Bad',
        url: 'https://example.com',
        method: 'TRACE',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists tests for a user', async () => {
    findMany.mockResolvedValue([row]);

    await expect(service.listForUser('user-1')).resolves.toHaveLength(1);
    await expect(service.listForUser('user-1')).resolves.toHaveLength(1);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('starts a run in-process when jobs are disabled', async () => {
    findFirst.mockResolvedValueOnce(row).mockResolvedValue({
      ...row,
      lastStatus: StressTestStatus.RUNNING,
    });
    runFindFirst.mockResolvedValue(null);
    runCreate.mockResolvedValue({ id: 'run-1' });
    update.mockResolvedValue({
      ...row,
      lastStatus: StressTestStatus.RUNNING,
    });

    await expect(service.runForUser('user-1', 'st-1')).resolves.toEqual(
      expect.objectContaining({ lastStatus: StressTestStatus.RUNNING }),
    );
    expect(jobs.enqueueStressTestRun).toHaveBeenCalledWith('run-1');
    expect(execute).toHaveBeenCalledWith('run-1');
  });

  it('enqueues a run when jobs are enabled', async () => {
    findFirst.mockResolvedValueOnce(row).mockResolvedValue({
      ...row,
      lastStatus: StressTestStatus.RUNNING,
    });
    runFindFirst.mockResolvedValue(null);
    runCreate.mockResolvedValue({ id: 'run-1' });
    update.mockResolvedValue({
      ...row,
      lastStatus: StressTestStatus.RUNNING,
    });
    jobs.enqueueStressTestRun.mockResolvedValue(true);

    await service.runForUser('user-1', 'st-1');

    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a second concurrent run', async () => {
    findFirst.mockResolvedValue(row);
    runFindFirst.mockResolvedValue({ id: 'run-open' });

    await expect(service.runForUser('user-1', 'st-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('deletes a test', async () => {
    deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.deleteForUser('user-1', 'st-1')).resolves.toBe(true);
  });

  it('throws when deleting a missing test', async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.deleteForUser('user-1', 'st-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
