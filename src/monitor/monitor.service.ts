import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache.keys';
import { JobsService } from '../jobs/jobs.service';
import { CreateMonitorInput } from './dto/create-monitor.input';
import { UpdateMonitorInput } from './dto/update-monitor.input';
import {
  parseMonitorConfig,
  serializeMonitorConfig,
  type MonitorConfigValue,
} from './monitor-config';
import { MonitorRunnerService } from './monitor-runner.service';
import { MonitorProbeService } from './monitor-probe.service';
import { MonitorSettingsService } from './monitor-settings.service';
import { MonitorStatus } from './monitor-status';
import { MonitorType } from './monitor-type';
import {
  resolveMonitorConfig,
  hasMonitorConfigUpdate,
} from './resolve-monitor-config';
import type { MonitorCheckResultView } from './monitor-check-result.model';

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

export type MonitorView = {
  id: string;
  name: string;
  type: MonitorType;
  enabled: boolean;
  intervalSec: number;
  timeoutMs: number;
  config: MonitorConfigValue;
  lastStatus: MonitorStatus;
  lastError: string | null;
  lastLatencyMs: number | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class MonitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: MonitorRunnerService,
    private readonly probe: MonitorProbeService,
    private readonly cache: CacheService,
    private readonly jobs: JobsService,
    private readonly settings: MonitorSettingsService,
  ) {}

  async listForUser(userId: string): Promise<MonitorView[]> {
    return this.cache.wrap(CacheKeys.monitorsList(userId), async () => {
      const monitors = await this.prisma.monitor.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: monitorSelect,
      });

      return monitors.map((monitor) => this.toView(monitor));
    });
  }

  async findForUser(userId: string, id: string): Promise<MonitorView> {
    return this.cache.wrap(CacheKeys.monitorItem(userId, id), async () =>
      this.toView(await this.requireOwned(userId, id)),
    );
  }

  async createForUser(
    userId: string,
    input: CreateMonitorInput,
  ): Promise<MonitorView> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Name is required');
    }

    const config = resolveMonitorConfig(input.type, input, true);
    const defaults = await this.settings.getForUser(userId);
    const created = await this.prisma.monitor.create({
      data: {
        userId,
        name,
        type: input.type,
        enabled: input.enabled ?? true,
        intervalSec: input.intervalSec ?? defaults.defaultIntervalSec,
        timeoutMs: input.timeoutMs ?? defaults.defaultTimeoutMs,
        config: serializeMonitorConfig(config),
      },
      select: monitorSelect,
    });
    this.cache.invalidatePrefix(CacheKeys.monitorsPrefix(userId));
    await this.syncJob(created);

    return this.toView(created);
  }

  async updateForUser(
    userId: string,
    id: string,
    input: UpdateMonitorInput,
  ): Promise<MonitorView> {
    const existing = await this.requireOwned(userId, id);
    const type = input.type ?? (existing.type as MonitorType);
    const hasConfigUpdate = hasMonitorConfigUpdate(input);

    if (type !== existing.type && !hasConfigUpdate) {
      throw new BadRequestException(
        'Config for the new monitor type is required',
      );
    }

    const config = hasConfigUpdate
      ? resolveMonitorConfig(type, input, true)
      : parseMonitorConfig(existing.config);

    const name = input.name?.trim();
    if (input.name !== undefined && !name) {
      throw new BadRequestException('Name is required');
    }

    const updated = await this.prisma.monitor.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        type,
        enabled: input.enabled ?? existing.enabled,
        intervalSec: input.intervalSec ?? existing.intervalSec,
        timeoutMs: input.timeoutMs ?? existing.timeoutMs,
        config: serializeMonitorConfig(config),
      },
      select: monitorSelect,
    });
    this.cache.invalidatePrefix(CacheKeys.monitorsPrefix(userId));
    await this.syncJob(updated);

    return this.toView(updated);
  }

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.monitor.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Monitor not found');
    }

    this.cache.invalidatePrefix(CacheKeys.monitorsPrefix(userId));
    await this.jobs.unscheduleMonitorCheck(id);
    return true;
  }

  async checkForUser(userId: string, id: string): Promise<MonitorView> {
    await this.requireOwned(userId, id);
    const updated = await this.runner.run(id);
    return this.toView(updated);
  }

  async probeForUser(
    userId: string,
    input: CreateMonitorInput,
  ): Promise<MonitorCheckResultView> {
    const config = resolveMonitorConfig(input.type, input, true);
    const defaults = await this.settings.getForUser(userId);
    const timeoutMs = input.timeoutMs ?? defaults.defaultTimeoutMs;
    return this.runProbe(input.type, config, timeoutMs);
  }

  async quickCheckForUser(
    userId: string,
    id: string,
    input?: UpdateMonitorInput,
  ): Promise<MonitorCheckResultView> {
    const existing = await this.requireOwned(userId, id);
    const type = (input?.type ?? existing.type) as MonitorType;
    const timeoutMs = input?.timeoutMs ?? existing.timeoutMs;

    let config;
    if (input && hasMonitorConfigUpdate(input)) {
      config = resolveMonitorConfig(type, input, true);
    } else if (input?.type && input.type !== existing.type) {
      throw new BadRequestException(
        'Config for the new monitor type is required',
      );
    } else {
      config = parseMonitorConfig(existing.config);
    }

    return this.runProbe(type, config, timeoutMs);
  }

  private async runProbe(
    type: MonitorType,
    config: ReturnType<typeof parseMonitorConfig>,
    timeoutMs: number,
  ): Promise<MonitorCheckResultView> {
    const result = await this.probe.probe(type, config, timeoutMs);
    return {
      status: result.status,
      error: result.error,
      latencyMs: result.latencyMs,
      checkedAt: new Date(),
    };
  }

  private async syncJob(monitor: {
    id: string;
    enabled: boolean;
    intervalSec: number;
  }): Promise<void> {
    if (monitor.enabled) {
      await this.jobs.scheduleMonitorCheck(monitor.id, monitor.intervalSec);
      return;
    }

    await this.jobs.unscheduleMonitorCheck(monitor.id);
  }

  private async requireOwned(userId: string, id: string) {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id, userId },
      select: monitorSelect,
    });

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    return monitor;
  }

  private toView(monitor: {
    id: string;
    name: string;
    type: string;
    enabled: boolean;
    intervalSec: number;
    timeoutMs: number;
    config: string;
    lastStatus: string;
    lastError: string | null;
    lastLatencyMs: number | null;
    lastCheckedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): MonitorView {
    return {
      id: monitor.id,
      name: monitor.name,
      type: monitor.type as MonitorType,
      enabled: monitor.enabled,
      intervalSec: monitor.intervalSec,
      timeoutMs: monitor.timeoutMs,
      config: parseMonitorConfig(monitor.config),
      lastStatus: monitor.lastStatus as MonitorStatus,
      lastError: monitor.lastError,
      lastLatencyMs: monitor.lastLatencyMs,
      lastCheckedAt: monitor.lastCheckedAt,
      createdAt: monitor.createdAt,
      updatedAt: monitor.updatedAt,
    };
  }
}
