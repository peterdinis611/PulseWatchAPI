import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache.keys';
import { JobsService } from '../jobs/jobs.service';
import { LoggerService } from '../logger/logger.service';
import { assertHttpMethod, assertHttpUrl } from './assert-http-url';
import { CreateStressTestInput } from './dto/create-stress-test.input';
import { UpdateStressTestInput } from './dto/update-stress-test.input';
import { deserializeSummary, type StressTestSummaryValue } from './k6-summary';
import { isStressTestDue } from './stress-test-schedule';
import { StressTestExecutorService } from './stress-test-executor.service';
import { StressTestStatus } from './stress-test-status';
import {
  DEFAULT_EXPECTED_STATUS,
  DEFAULT_SCHEDULE_INTERVAL_SEC,
  DEFAULT_STRESS_TEST_DURATION_SEC,
  DEFAULT_STRESS_TEST_VUS,
} from './stress-test.constants';

const stressTestSelect = {
  id: true,
  userId: true,
  name: true,
  url: true,
  method: true,
  vus: true,
  durationSec: true,
  expectedStatus: true,
  p95Ms: true,
  maxFailRate: true,
  lastStatus: true,
  lastError: true,
  lastSummary: true,
  lastRunAt: true,
  scheduleEnabled: true,
  scheduleIntervalSec: true,
  scheduleLastRunAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const runSelect = {
  id: true,
  stressTestId: true,
  status: true,
  error: true,
  summary: true,
  startedAt: true,
  finishedAt: true,
} as const;

export type StressTestView = {
  id: string;
  name: string;
  url: string;
  method: string;
  vus: number;
  durationSec: number;
  expectedStatus: number;
  p95Ms: number | null;
  maxFailRate: number | null;
  lastStatus: StressTestStatus;
  lastError: string | null;
  lastSummary: StressTestSummaryValue | null;
  lastRunAt: Date | null;
  scheduleEnabled: boolean;
  scheduleIntervalSec: number | null;
  scheduleLastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StressTestRunView = {
  id: string;
  stressTestId: string;
  status: StressTestStatus;
  error: string | null;
  summary: StressTestSummaryValue | null;
  startedAt: Date;
  finishedAt: Date | null;
};

@Injectable()
export class StressTestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly jobs: JobsService,
    private readonly executor: StressTestExecutorService,
    private readonly logger: LoggerService,
  ) {}

  async listForUser(userId: string): Promise<StressTestView[]> {
    return this.cache.wrap(CacheKeys.stressTestsList(userId), async () => {
      const tests = await this.prisma.stressTest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: stressTestSelect,
      });

      return tests.map((test) => this.toView(test));
    });
  }

  async findForUser(userId: string, id: string): Promise<StressTestView> {
    return this.cache.wrap(CacheKeys.stressTestItem(userId, id), async () =>
      this.toView(await this.requireOwned(userId, id)),
    );
  }

  async listRunsForUser(
    userId: string,
    id: string,
  ): Promise<StressTestRunView[]> {
    await this.requireOwned(userId, id);
    const runs = await this.prisma.stressTestRun.findMany({
      where: { stressTestId: id },
      orderBy: { startedAt: 'desc' },
      select: runSelect,
    });

    return runs.map((run) => this.toRunView(run));
  }

  async createForUser(
    userId: string,
    input: CreateStressTestInput,
  ): Promise<StressTestView> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Name is required');
    }

    const created = await this.prisma.stressTest.create({
      data: {
        userId,
        name,
        url: assertHttpUrl(input.url),
        method: assertHttpMethod(input.method),
        vus: input.vus ?? DEFAULT_STRESS_TEST_VUS,
        durationSec: input.durationSec ?? DEFAULT_STRESS_TEST_DURATION_SEC,
        expectedStatus: input.expectedStatus ?? DEFAULT_EXPECTED_STATUS,
        p95Ms: input.p95Ms ?? null,
        maxFailRate: input.maxFailRate ?? null,
        scheduleEnabled: input.scheduleEnabled ?? false,
        scheduleIntervalSec:
          input.scheduleEnabled && input.scheduleIntervalSec
            ? input.scheduleIntervalSec
            : input.scheduleEnabled
              ? DEFAULT_SCHEDULE_INTERVAL_SEC
              : null,
      },
      select: stressTestSelect,
    });
    this.cache.invalidatePrefix(CacheKeys.stressTestsPrefix(userId));

    await this.syncSchedule(created);
    return this.toView(created);
  }

  async updateForUser(
    userId: string,
    id: string,
    input: UpdateStressTestInput,
  ): Promise<StressTestView> {
    const existing = await this.requireOwned(userId, id);
    const name = input.name?.trim();
    if (input.name !== undefined && !name) {
      throw new BadRequestException('Name is required');
    }

    const scheduleEnabled = input.scheduleEnabled ?? existing.scheduleEnabled;
    const scheduleIntervalSec =
      input.scheduleIntervalSec !== undefined
        ? input.scheduleIntervalSec
        : existing.scheduleIntervalSec;

    const updated = await this.prisma.stressTest.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        url: input.url !== undefined ? assertHttpUrl(input.url) : existing.url,
        method:
          input.method !== undefined
            ? assertHttpMethod(input.method)
            : existing.method,
        vus: input.vus ?? existing.vus,
        durationSec: input.durationSec ?? existing.durationSec,
        expectedStatus: input.expectedStatus ?? existing.expectedStatus,
        p95Ms: input.p95Ms === undefined ? existing.p95Ms : input.p95Ms,
        maxFailRate:
          input.maxFailRate === undefined
            ? existing.maxFailRate
            : input.maxFailRate,
        scheduleEnabled,
        scheduleIntervalSec: scheduleEnabled
          ? (scheduleIntervalSec ?? DEFAULT_SCHEDULE_INTERVAL_SEC)
          : null,
      },
      select: stressTestSelect,
    });
    this.cache.invalidatePrefix(CacheKeys.stressTestsPrefix(userId));

    await this.syncSchedule(updated);
    return this.toView(updated);
  }

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.stressTest.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Stress test not found');
    }

    this.cache.invalidatePrefix(CacheKeys.stressTestsPrefix(userId));
    await this.jobs.unscheduleStressTest(id);
    return true;
  }

  async runScheduled(stressTestId: string): Promise<void> {
    const test = await this.prisma.stressTest.findUnique({
      where: { id: stressTestId },
      select: stressTestSelect,
    });

    if (!test?.scheduleEnabled || !test.scheduleIntervalSec) {
      return;
    }

    try {
      await this.startRun(test.userId, test.id);
    } catch (error) {
      if (error instanceof ConflictException) {
        return;
      }
      throw error;
    }
  }

  async runDueScheduled(): Promise<void> {
    const tests = await this.prisma.stressTest.findMany({
      where: { scheduleEnabled: true },
      select: stressTestSelect,
    });

    for (const test of tests) {
      if (!isStressTestDue(test)) {
        continue;
      }

      try {
        await this.startRun(test.userId, test.id);
      } catch (error) {
        if (error instanceof ConflictException) {
          continue;
        }
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Scheduled stress test failed for ${test.id}`,
          stack,
          StressTestService.name,
        );
      }
    }
  }

  async runForUser(userId: string, id: string): Promise<StressTestView> {
    await this.requireOwned(userId, id);
    await this.startRun(userId, id);
    return this.findForUser(userId, id);
  }

  private async startRun(userId: string, id: string): Promise<void> {
    const running = await this.prisma.stressTestRun.findFirst({
      where: { stressTestId: id, status: StressTestStatus.RUNNING },
      select: { id: true },
    });

    if (running) {
      throw new ConflictException('A k6 run is already in progress');
    }

    const now = new Date();
    const run = await this.prisma.stressTestRun.create({
      data: {
        stressTestId: id,
        status: StressTestStatus.RUNNING,
      },
      select: { id: true },
    });

    await this.prisma.stressTest.update({
      where: { id },
      data: {
        lastStatus: StressTestStatus.RUNNING,
        lastError: null,
        scheduleLastRunAt: now,
      },
    });
    this.cache.invalidatePrefix(CacheKeys.stressTestsPrefix(userId));

    try {
      const queued = await this.jobs.enqueueStressTestRun(run.id);
      if (!queued) {
        void this.executeInProcess(run.id);
      }
    } catch {
      this.logger.warn(
        `Failed to enqueue stress test ${id}, running in-process`,
        StressTestService.name,
      );
      void this.executeInProcess(run.id);
    }
  }

  private async syncSchedule(test: {
    id: string;
    scheduleEnabled: boolean;
    scheduleIntervalSec: number | null;
  }): Promise<void> {
    if (test.scheduleEnabled && test.scheduleIntervalSec) {
      await this.jobs.scheduleStressTest(test.id, test.scheduleIntervalSec);
      return;
    }

    await this.jobs.unscheduleStressTest(test.id);
  }

  private executeInProcess(runId: string): void {
    void this.executor.execute(runId).catch((error: unknown) => {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `In-process stress test run ${runId} failed`,
        stack,
        StressTestService.name,
      );
    });
  }

  private async requireOwned(userId: string, id: string) {
    const test = await this.prisma.stressTest.findFirst({
      where: { id, userId },
      select: stressTestSelect,
    });

    if (!test) {
      throw new NotFoundException('Stress test not found');
    }

    return test;
  }

  private toView(test: {
    id: string;
    name: string;
    url: string;
    method: string;
    vus: number;
    durationSec: number;
    expectedStatus: number;
    p95Ms: number | null;
    maxFailRate: number | null;
    lastStatus: string;
    lastError: string | null;
    lastSummary: string | null;
    lastRunAt: Date | null;
    scheduleEnabled: boolean;
    scheduleIntervalSec: number | null;
    scheduleLastRunAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): StressTestView {
    return {
      id: test.id,
      name: test.name,
      url: test.url,
      method: test.method,
      vus: test.vus,
      durationSec: test.durationSec,
      expectedStatus: test.expectedStatus,
      p95Ms: test.p95Ms,
      maxFailRate: test.maxFailRate,
      lastStatus: test.lastStatus as StressTestStatus,
      lastError: test.lastError,
      lastSummary: deserializeSummary(test.lastSummary),
      lastRunAt: test.lastRunAt,
      scheduleEnabled: test.scheduleEnabled,
      scheduleIntervalSec: test.scheduleIntervalSec,
      scheduleLastRunAt: test.scheduleLastRunAt,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
    };
  }

  private toRunView(run: {
    id: string;
    stressTestId: string;
    status: string;
    error: string | null;
    summary: string | null;
    startedAt: Date;
    finishedAt: Date | null;
  }): StressTestRunView {
    return {
      id: run.id,
      stressTestId: run.stressTestId,
      status: run.status as StressTestStatus,
      error: run.error,
      summary: deserializeSummary(run.summary),
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    };
  }
}
