import { Injectable, OnModuleInit } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StressTestJobsSyncService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.jobs.isEnabled()) {
      return;
    }

    const tests = await this.prisma.stressTest.findMany({
      select: {
        id: true,
        scheduleEnabled: true,
        scheduleIntervalSec: true,
      },
    });

    for (const test of tests) {
      if (test.scheduleEnabled && test.scheduleIntervalSec) {
        await this.jobs.scheduleStressTest(test.id, test.scheduleIntervalSec);
      } else {
        await this.jobs.unscheduleStressTest(test.id);
      }
    }

    this.logger.log(
      `Synced ${tests.length} stress test job schedulers`,
      StressTestJobsSyncService.name,
    );
  }
}
