import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ALERT_COOLDOWN_SEC } from './monitor.constants';
import type { MonitorSettingsView } from './monitor-settings.service';

export type MonitorAlertContext = {
  id: string;
  alertsMuted: boolean;
  lastDownNotifiedAt: Date | null;
  lastRecoverNotifiedAt: Date | null;
};

export type AlertEvent = 'down' | 'recover';

@Injectable()
export class MonitorAlertService {
  constructor(private readonly prisma: PrismaService) {}

  shouldNotify(
    monitor: MonitorAlertContext,
    settings: MonitorSettingsView,
    event: AlertEvent,
  ): boolean {
    if (monitor.alertsMuted) {
      return false;
    }

    if (settings.fleetAlertsMuted) {
      return false;
    }

    if (
      settings.maintenanceUntil &&
      settings.maintenanceUntil.getTime() > Date.now()
    ) {
      return false;
    }

    const lastAt =
      event === 'down'
        ? monitor.lastDownNotifiedAt
        : monitor.lastRecoverNotifiedAt;

    if (!lastAt) {
      return true;
    }

    const elapsedMs = Date.now() - lastAt.getTime();
    return elapsedMs >= ALERT_COOLDOWN_SEC * 1000;
  }

  async recordNotified(monitorId: string, event: AlertEvent): Promise<void> {
    const now = new Date();
    await this.prisma.monitor.update({
      where: { id: monitorId },
      data:
        event === 'down'
          ? { lastDownNotifiedAt: now }
          : { lastRecoverNotifiedAt: now },
    });
  }
}
