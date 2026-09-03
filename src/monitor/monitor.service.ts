import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonitorInput } from './dto/create-monitor.input';
import { UpdateMonitorInput } from './dto/update-monitor.input';
import {
  parseMonitorConfig,
  serializeMonitorConfig,
  type MonitorConfigValue,
} from './monitor-config';
import {
  DEFAULT_INTERVAL_SEC,
  DEFAULT_TIMEOUT_MS,
} from './monitor.constants';
import { MonitorRunnerService } from './monitor-runner.service';
import { MonitorStatus } from './monitor-status';
import { MonitorType } from './monitor-type';
import { resolveMonitorConfig } from './resolve-monitor-config';

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
  ) {}

  async listForUser(userId: string): Promise<MonitorView[]> {
    const monitors = await this.prisma.monitor.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: monitorSelect,
    });

    return monitors.map((monitor) => this.toView(monitor));
  }

  async findForUser(userId: string, id: string): Promise<MonitorView> {
    return this.toView(await this.requireOwned(userId, id));
  }

  async createForUser(
    userId: string,
    input: CreateMonitorInput,
  ): Promise<MonitorView> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Name is required');
    }

    const config = resolveMonitorConfig(input.type, input);
    const created = await this.prisma.monitor.create({
      data: {
        userId,
        name,
        type: input.type,
        enabled: input.enabled ?? true,
        intervalSec: input.intervalSec ?? DEFAULT_INTERVAL_SEC,
        timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        config: serializeMonitorConfig(config),
      },
      select: monitorSelect,
    });

    return this.toView(created);
  }

  async updateForUser(
    userId: string,
    id: string,
    input: UpdateMonitorInput,
  ): Promise<MonitorView> {
    const existing = await this.requireOwned(userId, id);
    const type = input.type ?? (existing.type as MonitorType);
    const hasConfigUpdate = Boolean(
      input.http || input.redis || input.database || input.tcp,
    );

    if (type !== existing.type && !hasConfigUpdate) {
      throw new BadRequestException(
        'Config for the new monitor type is required',
      );
    }

    const config = hasConfigUpdate
      ? resolveMonitorConfig(type, input)
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

    return this.toView(updated);
  }

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.monitor.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Monitor not found');
    }

    return true;
  }

  async checkForUser(userId: string, id: string): Promise<MonitorView> {
    await this.requireOwned(userId, id);
    const updated = await this.runner.run(id);
    return this.toView(updated);
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
