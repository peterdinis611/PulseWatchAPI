import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { areJobsEnabled } from '../jobs/are-jobs-enabled';
import { LoggerService } from '../logger/logger.service';
import { StressTestService } from './stress-test.service';

@Injectable()
export class StressTestSchedulerService {
  constructor(
    private readonly stressTests: StressTestService,
    private readonly logger: LoggerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'stress-test-schedules',
    disabled: process.env.NODE_ENV === 'test' || areJobsEnabled(),
  })
  async tick(): Promise<void> {
    if (process.env.NODE_ENV === 'test' || areJobsEnabled()) {
      return;
    }

    try {
      await this.stressTests.runDueScheduled();
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        'Stress test scheduler tick failed',
        stack,
        StressTestSchedulerService.name,
      );
    }
  }
}
