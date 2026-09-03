import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggerService } from '../logger/logger.service';
import { MonitorRunnerService } from './monitor-runner.service';

@Injectable()
export class MonitorSchedulerService {
  constructor(
    private readonly runner: MonitorRunnerService,
    private readonly logger: LoggerService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'monitor-checks',
    disabled: process.env.NODE_ENV === 'test',
  })
  async tick(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    try {
      await this.runner.checkDue();
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        'Monitor scheduler tick failed',
        stack,
        MonitorSchedulerService.name,
      );
    }
  }
}
