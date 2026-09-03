import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from '../logger/logger.service';
import {
  STRESS_TEST_QUEUE,
  type StressTestJobData,
} from '../jobs/stress-test.job';
import { StressTestExecutorService } from './stress-test-executor.service';

@Processor(STRESS_TEST_QUEUE, { concurrency: 1 })
export class StressTestProcessor extends WorkerHost {
  constructor(
    private readonly executor: StressTestExecutorService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job<StressTestJobData>): Promise<void> {
    const runId = job.data?.runId;
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
