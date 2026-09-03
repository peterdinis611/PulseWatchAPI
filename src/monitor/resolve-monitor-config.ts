import { BadRequestException } from '@nestjs/common';
import { CreateMonitorInput } from './dto/create-monitor.input';
import { HTTP_METHODS, type HttpMethod } from './monitor.constants';
import { MonitorConfigValue } from './monitor-config';
import { MonitorType } from './monitor-type';

export function resolveMonitorConfig(
  type: MonitorType,
  input: Pick<CreateMonitorInput, 'http' | 'redis' | 'database' | 'tcp'>,
): MonitorConfigValue {
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

function resolveHttp(
  input: CreateMonitorInput['http'],
): MonitorConfigValue {
  if (!input?.url) {
    throw new BadRequestException('http config is required for HTTP monitors');
  }

  const url = parseAbsoluteUrl(input.url, 'Invalid HTTP URL');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('HTTP monitors require an http or https URL');
  }

  const method = (input.method ?? 'GET').toUpperCase();
  if (!HTTP_METHODS.includes(method as HttpMethod)) {
    throw new BadRequestException('HTTP method must be GET, HEAD, POST, or PUT');
  }

  return {
    url: input.url,
    method,
    expectedStatus: input.expectedStatus ?? 200,
  };
}

function resolveRedis(
  input: CreateMonitorInput['redis'],
): MonitorConfigValue {
  if (!input?.url) {
    throw new BadRequestException('redis config is required for REDIS monitors');
  }

  const url = parseAbsoluteUrl(input.url, 'Invalid Redis URL');
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new BadRequestException(
      'Redis monitors require a redis:// or rediss:// URL',
    );
  }

  return { url: input.url };
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
  const ok =
    lower.startsWith('postgres://') ||
    lower.startsWith('postgresql://') ||
    lower.startsWith('mysql://') ||
    lower.startsWith('mysql2://') ||
    lower.startsWith('file:') ||
    lower.startsWith('sqlite:');

  if (!ok) {
    throw new BadRequestException(
      'Database monitors require a postgres://, mysql://, or file: URL',
    );
  }

  return { url: value };
}

function resolveTcp(input: CreateMonitorInput['tcp']): MonitorConfigValue {
  if (!input?.host || input.port == null) {
    throw new BadRequestException('tcp config is required for TCP monitors');
  }

  return {
    host: input.host.trim(),
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
