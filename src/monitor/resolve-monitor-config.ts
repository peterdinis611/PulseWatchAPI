import { BadRequestException } from '@nestjs/common';
import { CreateMonitorInput } from './dto/create-monitor.input';
import { isValidTcpHost } from './is-valid-tcp-host';
import { HTTP_METHODS, type HttpMethod } from './monitor.constants';
import { MonitorConfigValue } from './monitor-config';
import { MonitorType } from './monitor-type';
import {
  presentConfigFields,
  validateMonitorTypeConfig,
} from './validate-monitor-type-config';

export function resolveMonitorConfig(
  type: MonitorType,
  input: Pick<CreateMonitorInput, 'http' | 'redis' | 'database' | 'tcp'>,
  required = true,
): MonitorConfigValue {
  const mismatch = validateMonitorTypeConfig(type, input, required);
  if (mismatch) {
    throw new BadRequestException(mismatch);
  }

  switch (type) {
    case MonitorType.HTTP:
      return resolveHttp(input.http);
    case MonitorType.REDIS:
      return resolveRedis(input.redis);
    case MonitorType.DATABASE:
      return resolveDatabase(input.database);
    case MonitorType.TCP:
      return resolveTcp(input.tcp);
    default:
      throw new BadRequestException('Unsupported monitor type');
  }
}

function resolveHttp(input: CreateMonitorInput['http']): MonitorConfigValue {
  if (!input?.url) {
    throw new BadRequestException('http config is required for HTTP monitors');
  }

  const raw = input.url.trim();
  const url = parseAbsoluteUrl(raw, 'Invalid HTTP URL');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('HTTP monitors require an http or https URL');
  }
  if (!url.hostname) {
    throw new BadRequestException('HTTP URL must include a hostname');
  }

  const method = (input.method ?? 'GET').toUpperCase();
  if (!HTTP_METHODS.includes(method as HttpMethod)) {
    throw new BadRequestException(
      'HTTP method must be GET, HEAD, POST, or PUT',
    );
  }

  return {
    url: raw,
    method,
    expectedStatus: input.expectedStatus ?? 200,
  };
}

function resolveRedis(input: CreateMonitorInput['redis']): MonitorConfigValue {
  if (!input?.url) {
    throw new BadRequestException(
      'redis config is required for REDIS monitors',
    );
  }

  const raw = input.url.trim();
  const url = parseAbsoluteUrl(raw, 'Invalid Redis URL');
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new BadRequestException(
      'Redis monitors require a redis:// or rediss:// URL',
    );
  }
  if (!url.hostname) {
    throw new BadRequestException('Redis URL must include a hostname');
  }

  return { url: raw };
}

function resolveDatabase(
  input: CreateMonitorInput['database'],
): MonitorConfigValue {
  if (!input?.url) {
    throw new BadRequestException(
      'database config is required for DATABASE monitors',
    );
  }

  const value = input.url.trim();
  const lower = value.toLowerCase();

  if (lower.startsWith('file:') || lower.startsWith('sqlite:')) {
    const path = value.replace(/^(file:|sqlite:)/i, '');
    if (!path || path.includes('\0')) {
      throw new BadRequestException('SQLite path is required');
    }
    return { url: value };
  }

  if (
    lower.startsWith('postgres://') ||
    lower.startsWith('postgresql://') ||
    lower.startsWith('mysql://') ||
    lower.startsWith('mysql2://')
  ) {
    const normalized = value.replace(/^mysql2:\/\//i, 'mysql://');
    const url = parseAbsoluteUrl(
      normalized.replace(/^postgres:\/\//i, 'postgresql://'),
      'Invalid database URL',
    );
    if (!url.hostname) {
      throw new BadRequestException('Database URL must include a hostname');
    }
    return { url: value };
  }

  throw new BadRequestException(
    'Database monitors require a postgres://, mysql://, or file: URL',
  );
}

function resolveTcp(input: CreateMonitorInput['tcp']): MonitorConfigValue {
  if (!input?.host || input.port == null) {
    throw new BadRequestException('tcp config is required for TCP monitors');
  }

  const host = input.host.trim();
  if (!isValidTcpHost(host)) {
    throw new BadRequestException('TCP host must be a hostname or IP address');
  }

  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    throw new BadRequestException('TCP port must be between 1 and 65535');
  }

  return {
    host,
    port: input.port,
  };
}

function parseAbsoluteUrl(value: string, message: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new BadRequestException(message);
  }
}

export function hasMonitorConfigUpdate(
  input: Pick<CreateMonitorInput, 'http' | 'redis' | 'database' | 'tcp'>,
): boolean {
  return presentConfigFields(input).length > 0;
}
