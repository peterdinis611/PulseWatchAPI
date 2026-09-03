import { Injectable, OnModuleInit } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonitorJobsSyncService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.jobs.isEnabled()) {
      return;
    }

    const monitors = await this.prisma.monitor.findMany({
      select: { id: true, enabled: true, intervalSec: true },
    });

    for (const monitor of monitors) {
      if (monitor.enabled) {
        await this.jobs.scheduleMonitorCheck(monitor.id, monitor.intervalSec);
      } else {
        await this.jobs.unscheduleMonitorCheck(monitor.id);
      }
    }

    this.logger.log(
      `Synced ${monitors.length} monitor job schedulers`,
      MonitorJobsSyncService.name,
    );
  }
}
