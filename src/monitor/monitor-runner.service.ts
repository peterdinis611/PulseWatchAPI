import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertDeliveryService } from '../notification/alert-delivery.service';
import { LoggerService } from '../logger/logger.service';
import { NotificationType } from '../notification/notification-type';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache.keys';
import { isMonitorDue, parseMonitorConfig } from './monitor-config';
import { MonitorAlertService } from './monitor-alert.service';
import { MonitorCheckHistoryService } from './monitor-check-history.service';
import { MonitorProbeService } from './monitor-probe.service';
import { MonitorSettingsService } from './monitor-settings.service';
import { MonitorStatus } from './monitor-status';
import { MonitorType } from './monitor-type';
import { monitorAlertSelect } from './monitor.select';
import { monitorUpdatedTrigger } from './monitor.events';
import { mapMonitorRow } from './monitor-view';

type MonitorRow = {
  id: string;
  userId: string;
  name: string;
  type: MonitorType;
  enabled: boolean;
  alertsMuted: boolean;
  intervalSec: number;
  timeoutMs: number;
  config: string;
  lastStatus: MonitorStatus;
  lastError: string | null;
  lastLatencyMs: number | null;
  lastCheckedAt: Date | null;
  lastDownNotifiedAt: Date | null;
  lastRecoverNotifiedAt: Date | null;
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
    private readonly alertPolicy: MonitorAlertService,
    private readonly history: MonitorCheckHistoryService,
    private readonly logger: LoggerService,
    private readonly cache: CacheService,
    private readonly settings: MonitorSettingsService,
    private readonly pubSub: PubSubService,
  ) {}

  async checkDue(): Promise<void> {
    const monitors = await this.prisma.monitor.findMany({
      where: { enabled: true },
      select: monitorAlertSelect,
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
        select: monitorAlertSelect,
      });
      this.cache.invalidatePrefix(CacheKeys.monitorsPrefix(monitor.userId));

      await this.history.record(id, {
        status: result.status,
        error: result.error,
        latencyMs: result.latencyMs,
        checkedAt,
      });

      await this.pubSub.publish(monitorUpdatedTrigger(monitor.userId), {
        monitorUpdated: mapMonitorRow(updated),
      });

      await this.notifyStatusChange(
        updated as MonitorRow,
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
      select: monitorAlertSelect,
    });

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    return monitor as MonitorRow;
  }

  private async notifyStatusChange(
    monitor: MonitorRow,
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
        if (!this.alertPolicy.shouldNotify(monitor, prefs, 'down')) {
          return;
        }
        const title = `${name} je dole`;
        const body = error ?? `${name} neprešiel kontrolou dostupnosti`;
        await this.notifications.createForUser(userId, {
          type: NotificationType.ALERT,
          title,
          body,
          monitorId: monitor.id,
        });
        await this.alertDelivery.deliver(prefs, {
          type: NotificationType.ALERT,
          title,
          body,
          monitorId: monitor.id,
          event: 'monitor.down',
        });
        await this.alertPolicy.recordNotified(monitor.id, 'down');
        return;
      }

      if (previous === MonitorStatus.DOWN && next === MonitorStatus.UP) {
        if (!prefs.notifyOnRecover) {
          return;
        }
        if (!this.alertPolicy.shouldNotify(monitor, prefs, 'recover')) {
          return;
        }
        const title = `${name} je opäť hore`;
        const body = `${name} opäť odpovedá na kontrolu`;
        await this.notifications.createForUser(userId, {
          type: NotificationType.SUCCESS,
          title,
          body,
          monitorId: monitor.id,
        });
        await this.alertDelivery.deliver(prefs, {
          type: NotificationType.SUCCESS,
          title,
          body,
          monitorId: monitor.id,
          event: 'monitor.recover',
        });
        await this.alertPolicy.recordNotified(monitor.id, 'recover');
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
