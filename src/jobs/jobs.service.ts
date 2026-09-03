import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { LoggerService } from '../logger/logger.service';
import {
  MONITOR_CHECK_JOB,
  MONITOR_CHECK_QUEUE,
  type MonitorCheckJobData,
  monitorCheckSchedulerId,
} from './monitor-check.job';
import {
  STRESS_TEST_JOB,
  STRESS_TEST_QUEUE,
  type StressTestJobData,
} from './stress-test.job';

export const MONITOR_CHECK_QUEUE_TOKEN = 'MONITOR_CHECK_QUEUE';
export const STRESS_TEST_QUEUE_TOKEN = 'STRESS_TEST_QUEUE';

export type MonitorCheckQueue = Pick<
  Queue<MonitorCheckJobData>,
  'upsertJobScheduler' | 'removeJobScheduler'
>;

export type StressTestQueue = Pick<Queue<StressTestJobData>, 'add'>;

@Injectable()
export class JobsService {
  constructor(
    @Inject(MONITOR_CHECK_QUEUE_TOKEN)
    private readonly queue: MonitorCheckQueue | null,
    @Inject(STRESS_TEST_QUEUE_TOKEN)
    private readonly stressQueue: StressTestQueue | null,
    private readonly logger: LoggerService,
  ) {}

  isEnabled(): boolean {
    return this.queue != null;
  }

  async scheduleMonitorCheck(
    monitorId: string,
    intervalSec: number,
  ): Promise<void> {
    if (!this.queue) {
      return;
    }

    await this.queue.upsertJobScheduler(
      monitorCheckSchedulerId(monitorId),
      { every: intervalSec * 1000 },
      {
        name: MONITOR_CHECK_JOB,
        data: { monitorId },
      },
    );

    this.logger.debug(
      `Scheduled ${MONITOR_CHECK_QUEUE} for ${monitorId} every ${intervalSec}s`,
      JobsService.name,
    );
  }

  async unscheduleMonitorCheck(monitorId: string): Promise<void> {
    if (!this.queue) {
      return;
    }

    await this.queue.removeJobScheduler(monitorCheckSchedulerId(monitorId));
    this.logger.debug(
      `Removed ${MONITOR_CHECK_QUEUE} scheduler for ${monitorId}`,
      JobsService.name,
    );
  }

  async enqueueStressTestRun(runId: string): Promise<boolean> {
    if (!this.stressQueue) {
      return false;
    }

    await this.stressQueue.add(STRESS_TEST_JOB, { runId }, { jobId: runId });

    this.logger.debug(
      `Enqueued ${STRESS_TEST_QUEUE} run ${runId}`,
      JobsService.name,
    );
    return true;
  }
}
