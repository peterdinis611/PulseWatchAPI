import { Injectable, NotFoundException } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { NotificationType } from '../notification/notification-type';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { isMonitorDue, parseMonitorConfig } from './monitor-config';
import { MonitorProbeService } from './monitor-probe.service';
import { MonitorStatus } from './monitor-status';
import { MonitorType } from './monitor-type';

const monitorSelect = {
  id: true,
  userId: true,
  name: true,
  type: true,
  enabled: true,
  intervalSec: true,
  timeoutMs: true,
  config: true,
  lastStatus: true,
  lastError: true,
  lastLatencyMs: true,
  lastCheckedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class MonitorRunnerService {
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly probe: MonitorProbeService,
    private readonly notifications: NotificationService,
    private readonly logger: LoggerService,
  ) {}

  async checkDue(): Promise<void> {
    const monitors = await this.prisma.monitor.findMany({
      where: { enabled: true },
      select: monitorSelect,
    });

    for (const monitor of monitors) {
      if (!isMonitorDue(monitor) || this.inFlight.has(monitor.id)) {
        continue;
      }
      await this.run(monitor.id);
    }
  }

  async run(id: string): Promise<{
    id: string;
    userId: string;
    name: string;
    type: MonitorType;
    enabled: boolean;
    intervalSec: number;
    timeoutMs: number;
    config: string;
    lastStatus: MonitorStatus;
    lastError: string | null;
    lastLatencyMs: number | null;
    lastCheckedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    if (this.inFlight.has(id)) {
      const current = await this.prisma.monitor.findUnique({
        where: { id },
        select: monitorSelect,
      });
      if (!current) {
        throw new NotFoundException('Monitor not found');
      }
      return current as Awaited<ReturnType<MonitorRunnerService['run']>>;
    }

    this.inFlight.add(id);

    try {
      const monitor = await this.prisma.monitor.findUnique({
        where: { id },
        select: monitorSelect,
      });

      if (!monitor) {
        throw new NotFoundException('Monitor not found');
      }

      const previousStatus = monitor.lastStatus as MonitorStatus;
      const result = await this.probe.probe(
        monitor.type as MonitorType,
        parseMonitorConfig(monitor.config),
        monitor.timeoutMs,
      );

      const updated = await this.prisma.monitor.update({
        where: { id },
        data: {
          lastStatus: result.status,
          lastError: result.error,
          lastLatencyMs: result.latencyMs,
          lastCheckedAt: new Date(),
        },
        select: monitorSelect,
      });

      await this.notifyStatusChange(
        monitor.userId,
        monitor.name,
        previousStatus,
        result.status,
        result.error,
      );

      this.logger.debug(
        `Monitor ${monitor.name} ${result.status} (${result.latencyMs}ms)`,
        MonitorRunnerService.name,
      );

      return updated as Awaited<ReturnType<MonitorRunnerService['run']>>;
    } finally {
      this.inFlight.delete(id);
    }
  }

  private async notifyStatusChange(
    userId: string,
    name: string,
    previous: MonitorStatus,
    next: MonitorStatus,
    error: string | null,
  ): Promise<void> {
    if (previous === next) {
      return;
    }

    if (previous === MonitorStatus.UNKNOWN && next === MonitorStatus.UP) {
      return;
    }

    if (next === MonitorStatus.DOWN) {
      await this.notifications.createForUser(userId, {
        type: NotificationType.ALERT,
        title: `${name} is down`,
        body: error ?? `${name} failed a health check`,
      });
      return;
    }

    if (previous === MonitorStatus.DOWN && next === MonitorStatus.UP) {
      await this.notifications.createForUser(userId, {
        type: NotificationType.SUCCESS,
        title: `${name} recovered`,
        body: `${name} is responding again`,
      });
    }
  }
}
