import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MonitorStatus } from './monitor-status';

export const CHECK_RETENTION_DAYS = 7;
export const MAX_CHECKS_PER_MONITOR = 2000;
export const DEFAULT_UPTIME_HOURS = 24;

const checkSelect = {
  id: true,
  monitorId: true,
  status: true,
  error: true,
  latencyMs: true,
  checkedAt: true,
} as const;

export type MonitorCheckView = {
  id: string;
  monitorId: string;
  status: MonitorStatus;
  error: string | null;
  latencyMs: number;
  checkedAt: Date;
};

export type MonitorUptimeView = {
  periodHours: number;
  totalChecks: number;
  upChecks: number;
  uptimePercent: number;
  avgLatencyMs: number | null;
};

@Injectable()
export class MonitorCheckHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    monitorId: string,
    result: {
      status: MonitorStatus;
      error: string | null;
      latencyMs: number;
      checkedAt?: Date;
    },
  ): Promise<void> {
    await this.prisma.monitorCheck.create({
      data: {
        monitorId,
        status: result.status,
        error: result.error,
        latencyMs: result.latencyMs,
        checkedAt: result.checkedAt ?? new Date(),
      },
    });

    const cutoff = new Date(
      Date.now() - CHECK_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.prisma.monitorCheck.deleteMany({
      where: { monitorId, checkedAt: { lt: cutoff } },
    });

    const excess = await this.prisma.monitorCheck.count({
      where: { monitorId },
    });
    if (excess > MAX_CHECKS_PER_MONITOR) {
      const toRemove = excess - MAX_CHECKS_PER_MONITOR;
      const oldest = await this.prisma.monitorCheck.findMany({
        where: { monitorId },
        orderBy: { checkedAt: 'asc' },
        take: toRemove,
        select: { id: true },
      });
      if (oldest.length > 0) {
        await this.prisma.monitorCheck.deleteMany({
          where: { id: { in: oldest.map((row) => row.id) } },
        });
      }
    }
  }

  async listForMonitor(
    userId: string,
    monitorId: string,
    hours = DEFAULT_UPTIME_HOURS,
    limit = 200,
  ): Promise<MonitorCheckView[]> {
    await this.requireOwned(userId, monitorId);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const checks = await this.prisma.monitorCheck.findMany({
      where: { monitorId, checkedAt: { gte: since } },
      orderBy: { checkedAt: 'asc' },
      take: limit,
      select: checkSelect,
    });

    return checks.map((row) => ({
      ...row,
      status: row.status as MonitorStatus,
    }));
  }

  async uptimeForMonitor(
    userId: string,
    monitorId: string,
    hours = DEFAULT_UPTIME_HOURS,
  ): Promise<MonitorUptimeView> {
    await this.requireOwned(userId, monitorId);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const checks = await this.prisma.monitorCheck.findMany({
      where: { monitorId, checkedAt: { gte: since } },
      select: { status: true, latencyMs: true },
    });

    const totalChecks = checks.length;
    const upChecks = checks.filter((c) => c.status === MonitorStatus.UP).length;
    const uptimePercent =
      totalChecks === 0 ? 100 : Math.round((upChecks / totalChecks) * 1000) / 10;
    const avgLatencyMs =
      totalChecks === 0
        ? null
        : Math.round(
            checks.reduce((sum, c) => sum + c.latencyMs, 0) / totalChecks,
          );

    return {
      periodHours: hours,
      totalChecks,
      upChecks,
      uptimePercent,
      avgLatencyMs,
    };
  }

  private async requireOwned(userId: string, monitorId: string): Promise<void> {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id: monitorId, userId },
      select: { id: true },
    });
    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }
  }
}
