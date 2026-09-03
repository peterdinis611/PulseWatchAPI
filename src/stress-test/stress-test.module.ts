import { Module } from '@nestjs/common';
import { areJobsEnabled } from '../jobs/are-jobs-enabled';
import { NotificationModule } from '../notification/notification.module';
import { K6RunnerService } from './k6-runner.service';
import { StressTestExecutorService } from './stress-test-executor.service';
import { StressTestProcessor } from './stress-test.processor';
import { StressTestResolver } from './stress-test.resolver';
import { StressTestService } from './stress-test.service';

const jobProviders = areJobsEnabled() ? [StressTestProcessor] : [];

@Module({
  imports: [NotificationModule],
  providers: [
    StressTestService,
    StressTestResolver,
    K6RunnerService,
    StressTestExecutorService,
    ...jobProviders,
  ],
  exports: [StressTestService],
})
export class StressTestModule {}
