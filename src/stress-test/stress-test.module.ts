import { Module } from '@nestjs/common';
import { areJobsEnabled } from '../jobs/are-jobs-enabled';
import { MonitorModule } from '../monitor/monitor.module';
import { NotificationModule } from '../notification/notification.module';
import { K6RunnerService } from './k6-runner.service';
import { StressTestExecutorService } from './stress-test-executor.service';
import { StressTestJobsSyncService } from './stress-test-jobs-sync.service';
import { StressTestProcessor } from './stress-test.processor';
import { StressTestResolver } from './stress-test.resolver';
import { StressTestSchedulerService } from './stress-test-scheduler.service';
import { StressTestService } from './stress-test.service';

const jobProviders = areJobsEnabled()
  ? [StressTestProcessor, StressTestJobsSyncService]
  : [];

@Module({
  imports: [NotificationModule, MonitorModule],
  providers: [
    StressTestService,
    StressTestResolver,
    K6RunnerService,
    StressTestExecutorService,
    StressTestSchedulerService,
    ...jobProviders,
  ],
  exports: [StressTestService],
})
export class StressTestModule {}
