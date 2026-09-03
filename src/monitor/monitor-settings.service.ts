import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache.keys';
import { DEFAULT_INTERVAL_SEC, DEFAULT_TIMEOUT_MS } from './monitor.constants';
import { UpdateMonitorSettingsInput } from './dto/update-monitor-settings.input';

const settingsSelect = {
  userId: true,
  defaultIntervalSec: true,
  defaultTimeoutMs: true,
  notifyOnDown: true,
  notifyOnRecover: true,
  webhookUrl: true,
  slackWebhookUrl: true,
  alertEmail: true,
  updatedAt: true,
} as const;

export type MonitorSettingsView = {
  defaultIntervalSec: number;
  defaultTimeoutMs: number;
  notifyOnDown: boolean;
  notifyOnRecover: boolean;
  webhookUrl: string | null;
  slackWebhookUrl: string | null;
  alertEmail: string | null;
  updatedAt: Date;
};

@Injectable()
export class MonitorSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  getForUser(userId: string): Promise<MonitorSettingsView> {
    return this.cache.wrap(
      CacheKeys.monitorSettings(userId),
      () => this.loadOrCreate(userId),
      this.cache.userTtlMs,
    );
  }

  async updateForUser(
    userId: string,
    input: UpdateMonitorSettingsInput,
  ): Promise<MonitorSettingsView> {
    const updated = await this.prisma.userMonitorSettings.upsert({
      where: { userId },
      create: {
        userId,
        defaultIntervalSec: input.defaultIntervalSec ?? DEFAULT_INTERVAL_SEC,
        defaultTimeoutMs: input.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
        notifyOnDown: input.notifyOnDown ?? true,
        notifyOnRecover: input.notifyOnRecover ?? true,
        webhookUrl: input.webhookUrl ?? null,
        slackWebhookUrl: input.slackWebhookUrl ?? null,
        alertEmail: input.alertEmail ?? null,
      },
      update: {
        ...(input.defaultIntervalSec !== undefined
          ? { defaultIntervalSec: input.defaultIntervalSec }
          : {}),
        ...(input.defaultTimeoutMs !== undefined
          ? { defaultTimeoutMs: input.defaultTimeoutMs }
          : {}),
        ...(input.notifyOnDown !== undefined
          ? { notifyOnDown: input.notifyOnDown }
          : {}),
        ...(input.notifyOnRecover !== undefined
          ? { notifyOnRecover: input.notifyOnRecover }
          : {}),
        ...(input.webhookUrl !== undefined
          ? { webhookUrl: input.webhookUrl || null }
          : {}),
        ...(input.slackWebhookUrl !== undefined
          ? { slackWebhookUrl: input.slackWebhookUrl || null }
          : {}),
        ...(input.alertEmail !== undefined
          ? { alertEmail: input.alertEmail || null }
          : {}),
      },
      select: settingsSelect,
    });
    this.cache.del(CacheKeys.monitorSettings(userId));

    return this.toView(updated);
  }

  private async loadOrCreate(userId: string): Promise<MonitorSettingsView> {
    const existing = await this.prisma.userMonitorSettings.findUnique({
      where: { userId },
      select: settingsSelect,
    });

    if (existing) {
      return this.toView(existing);
    }

    const created = await this.prisma.userMonitorSettings
      .create({
        data: { userId },
        select: settingsSelect,
      })
      .catch(async (error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const raced = await this.prisma.userMonitorSettings.findUnique({
            where: { userId },
            select: settingsSelect,
          });
          if (raced) {
            return raced;
          }
        }
        throw error;
      });

    return this.toView(created);
  }

  private toView(row: {
    defaultIntervalSec: number;
    defaultTimeoutMs: number;
    notifyOnDown: boolean;
    notifyOnRecover: boolean;
    webhookUrl: string | null;
    slackWebhookUrl: string | null;
    alertEmail: string | null;
    updatedAt: Date;
  }): MonitorSettingsView {
    return {
      defaultIntervalSec: row.defaultIntervalSec,
      defaultTimeoutMs: row.defaultTimeoutMs,
      notifyOnDown: row.notifyOnDown,
      notifyOnRecover: row.notifyOnRecover,
      webhookUrl: row.webhookUrl,
      slackWebhookUrl: row.slackWebhookUrl,
      alertEmail: row.alertEmail,
      updatedAt: row.updatedAt,
    };
  }
}
