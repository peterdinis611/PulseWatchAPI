import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from '../logger/logger.service';
import {
  STRESS_TEST_JOB,
  STRESS_TEST_QUEUE,
  STRESS_TEST_SCHEDULE_JOB,
  type StressTestJobData,
} from '../jobs/stress-test.job';
import { StressTestExecutorService } from './stress-test-executor.service';
import { StressTestService } from './stress-test.service';

@Processor(STRESS_TEST_QUEUE, { concurrency: 1 })
export class StressTestProcessor extends WorkerHost {
  constructor(
    private readonly executor: StressTestExecutorService,
    private readonly stressTests: StressTestService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job<StressTestJobData>): Promise<void> {
    if (job.name === STRESS_TEST_SCHEDULE_JOB) {
      const stressTestId =
        'stressTestId' in job.data ? job.data.stressTestId : undefined;
      if (!stressTestId) {
        this.logger.warn(
          `Stress test schedule job ${job.id} is missing stressTestId`,
          StressTestProcessor.name,
        );
        return;
      }
      await this.stressTests.runScheduled(stressTestId);
      return;
    }

    const runId = 'runId' in job.data ? job.data.runId : undefined;
    if (!runId) {
      this.logger.warn(
        `Stress test job ${job.id} is missing runId`,
        StressTestProcessor.name,
      );
      return;
    }

    await this.executor.execute(runId);
  }
}
