import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { jobConcurrency } from '../jobs/jobs.constants';
import {
  MONITOR_CHECK_QUEUE,
  type MonitorCheckJobData,
} from '../jobs/monitor-check.job';
import { MonitorRunnerService } from './monitor-runner.service';

@Processor(MONITOR_CHECK_QUEUE, { concurrency: jobConcurrency() })
export class MonitorCheckProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: MonitorRunnerService,
    private readonly jobs: JobsService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job<MonitorCheckJobData>): Promise<void> {
    const monitorId = job.data?.monitorId;
    if (!monitorId) {
      this.logger.warn(
        `Monitor check job ${job.id} is missing monitorId`,
        MonitorCheckProcessor.name,
      );
      return;
    }

    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      select: { id: true, enabled: true },
    });

    if (!monitor || !monitor.enabled) {
      await this.jobs.unscheduleMonitorCheck(monitorId);
      return;
    }

    await this.runner.run(monitorId);
  }
}
