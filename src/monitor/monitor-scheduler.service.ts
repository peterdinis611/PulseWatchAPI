import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitorRunnerService } from './monitor-runner.service';

@Injectable()
export class MonitorSchedulerService {
  constructor(private readonly runner: MonitorRunnerService) {}

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'monitor-checks',
    disabled: process.env.NODE_ENV === 'test',
  })
  async tick(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    await this.runner.checkDue();
  }
}
