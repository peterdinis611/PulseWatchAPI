import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertDeliveryService } from '../notification/alert-delivery.service';
import { LoggerService } from '../logger/logger.service';
import { NotificationType } from '../notification/notification-type';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache.keys';
import { isMonitorDue, parseMonitorConfig } from './monitor-config';
import { MonitorCheckHistoryService } from './monitor-check-history.service';
import { MonitorProbeService } from './monitor-probe.service';
import { MonitorSettingsService } from './monitor-settings.service';
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

type MonitorRow = {
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
};

@Injectable()
export class MonitorRunnerService {
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly probe: MonitorProbeService,
    private readonly notifications: NotificationService,
    private readonly alertDelivery: AlertDeliveryService,
    private readonly history: MonitorCheckHistoryService,
    private readonly logger: LoggerService,
    private readonly cache: CacheService,
    private readonly settings: MonitorSettingsService,
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

      try {
        await this.run(monitor.id);
      } catch (error) {
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Scheduled check failed for monitor ${monitor.id}`,
          stack,
          MonitorRunnerService.name,
        );
      }
    }
  }

  async run(id: string): Promise<MonitorRow> {
    if (this.inFlight.has(id)) {
      return this.requireById(id);
    }

    this.inFlight.add(id);

    try {
      const monitor = await this.requireById(id);
      const previousStatus = monitor.lastStatus;
      const result = await this.probe.probe(
        monitor.type,
        parseMonitorConfig(monitor.config),
        monitor.timeoutMs,
      );
      const checkedAt = new Date();

      const updated = await this.prisma.monitor.update({
        where: { id },
        data: {
          lastStatus: result.status,
          lastError: result.error,
          lastLatencyMs: result.latencyMs,
          lastCheckedAt: checkedAt,
        },
        select: monitorSelect,
      });
      this.cache.invalidatePrefix(CacheKeys.monitorsPrefix(monitor.userId));

      await this.history.record(id, {
        status: result.status,
        error: result.error,
        latencyMs: result.latencyMs,
        checkedAt,
      });

      await this.notifyStatusChange(
        monitor.id,
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

      return updated as MonitorRow;
    } finally {
      this.inFlight.delete(id);
    }
  }

  private async requireById(id: string): Promise<MonitorRow> {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id },
      select: monitorSelect,
    });

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    return monitor as MonitorRow;
  }

  private async notifyStatusChange(
    monitorId: string,
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

    try {
      const prefs = await this.settings.getForUser(userId);

      if (next === MonitorStatus.DOWN) {
        if (!prefs.notifyOnDown) {
          return;
        }
        const title = `${name} je dole`;
        const body = error ?? `${name} neprešiel kontrolou dostupnosti`;
        await this.notifications.createForUser(userId, {
          type: NotificationType.ALERT,
          title,
          body,
          monitorId,
        });
        await this.alertDelivery.deliver(prefs, {
          type: NotificationType.ALERT,
          title,
          body,
          monitorId,
          event: 'monitor.down',
        });
        return;
      }

      if (previous === MonitorStatus.DOWN && next === MonitorStatus.UP) {
        if (!prefs.notifyOnRecover) {
          return;
        }
        const title = `${name} je opäť hore`;
        const body = `${name} opäť odpovedá na kontrolu`;
        await this.notifications.createForUser(userId, {
          type: NotificationType.SUCCESS,
          title,
          body,
          monitorId,
        });
        await this.alertDelivery.deliver(prefs, {
          type: NotificationType.SUCCESS,
          title,
          body,
          monitorId,
          event: 'monitor.recover',
        });
      }
    } catch (notifyError) {
      const stack =
        notifyError instanceof Error ? notifyError.stack : undefined;
      this.logger.error(
        `Failed to notify status change for ${name}`,
        stack,
        MonitorRunnerService.name,
      );
    }
  }
}
