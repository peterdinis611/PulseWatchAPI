import { isIP } from 'node:net';
import { BadRequestException } from '@nestjs/common';
import { CreateMonitorInput } from './dto/create-monitor.input';
import { DNS_RECORD_TYPES, DnsRecordType } from './dns-record-type';
import { isValidTcpHost } from './is-valid-tcp-host';
import {
  HTTP_METHODS,
  MAX_CERT_EXPIRY_DAYS,
  MAX_GRPC_SERVICE_LENGTH,
  MAX_KAFKA_TOPIC_LENGTH,
  type HttpMethod,
} from './monitor.constants';
import { MonitorConfigValue } from './monitor-config';
import { MonitorType } from './monitor-type';
import {
  presentConfigFields,
  validateMonitorTypeConfig,
} from './validate-monitor-type-config';

type MonitorConfigInputs = Pick<
  CreateMonitorInput,
  | 'http'
  | 'redis'
  | 'database'
  | 'tcp'
  | 'ssl'
  | 'dns'
  | 'smtp'
  | 'kafka'
  | 'grpc'
>;

export function resolveMonitorConfig(
  type: MonitorType,
  input: MonitorConfigInputs,
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
    case MonitorType.SSL:
      return resolveSsl(input.ssl);
    case MonitorType.DNS:
      return resolveDns(input.dns);
    case MonitorType.SMTP:
      return resolveSmtp(input.smtp);
    case MonitorType.KAFKA:
      return resolveKafka(input.kafka);
    case MonitorType.GRPC:
      return resolveGrpc(input.grpc);
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
  return resolveHostPort(input, 'TCP', 'tcp');
}

function resolveSsl(input: CreateMonitorInput['ssl']): MonitorConfigValue {
  const base = resolveHostPort(input, 'SSL', 'ssl');
  const serverName = input?.serverName?.trim();
  if (serverName && !isValidTcpHost(serverName)) {
    throw new BadRequestException(
      'SSL serverName must be a hostname or IP address',
    );
  }

  const minDaysUntilExpiry = input?.minDaysUntilExpiry ?? 0;
  if (
    !Number.isInteger(minDaysUntilExpiry) ||
    minDaysUntilExpiry < 0 ||
    minDaysUntilExpiry > MAX_CERT_EXPIRY_DAYS
  ) {
    throw new BadRequestException(
      `SSL minDaysUntilExpiry must be between 0 and ${MAX_CERT_EXPIRY_DAYS}`,
    );
  }

  return {
    ...base,
    ...(serverName ? { serverName } : {}),
    minDaysUntilExpiry,
    allowUnauthorized: input?.allowUnauthorized ?? false,
  };
}

function resolveDns(input: CreateMonitorInput['dns']): MonitorConfigValue {
  if (!input?.host) {
    throw new BadRequestException('dns config is required for DNS monitors');
  }

  const host = input.host.trim();
  if (!isValidTcpHost(host)) {
    throw new BadRequestException('DNS host must be a hostname or IP address');
  }

  const recordType = (input.recordType ?? DnsRecordType.A).toUpperCase();
  if (!DNS_RECORD_TYPES.includes(recordType as DnsRecordType)) {
    throw new BadRequestException(
      'DNS recordType must be A, AAAA, CNAME, MX, TXT, or NS',
    );
  }

  const nameserver = input.nameserver?.trim();
  if (nameserver && !isIP(nameserver)) {
    throw new BadRequestException(
      'DNS nameserver must be an IPv4 or IPv6 address',
    );
  }

  const expectedValue = input.expectedValue?.trim();
  return {
    host,
    recordType,
    ...(expectedValue ? { expectedValue } : {}),
    ...(nameserver ? { nameserver } : {}),
  };
}

function resolveSmtp(input: CreateMonitorInput['smtp']): MonitorConfigValue {
  const base = resolveHostPort(input, 'SMTP', 'smtp');
  const secure = input?.secure ?? false;
  const startTls = input?.startTls ?? false;
  if (secure && startTls) {
    throw new BadRequestException(
      'SMTP secure and startTls cannot both be enabled',
    );
  }

  return {
    ...base,
    secure,
    startTls,
    allowUnauthorized: input?.allowUnauthorized ?? false,
  };
}

function resolveKafka(input: CreateMonitorInput['kafka']): MonitorConfigValue {
  const base = resolveHostPort(input, 'KAFKA', 'kafka');
  const topic = input?.topic?.trim();
  if (
    topic &&
    (topic.length > MAX_KAFKA_TOPIC_LENGTH || !/^[a-z0-9._-]+$/i.test(topic))
  ) {
    throw new BadRequestException('Kafka topic is invalid');
  }

  return {
    ...base,
    tls: input?.tls ?? false,
    ...(topic ? { topic } : {}),
  };
}

function resolveGrpc(input: CreateMonitorInput['grpc']): MonitorConfigValue {
  const base = resolveHostPort(input, 'GRPC', 'grpc');
  const service = input?.service?.trim() ?? '';
  if (service.length > MAX_GRPC_SERVICE_LENGTH) {
    throw new BadRequestException('gRPC service name is too long');
  }

  return {
    ...base,
    tls: input?.tls ?? false,
    service,
    allowUnauthorized: input?.allowUnauthorized ?? false,
  };
}

function resolveHostPort(
  input: { host?: string; port?: number } | undefined,
  label: string,
  field: string,
): { host: string; port: number } {
  if (!input?.host || input.port == null) {
    throw new BadRequestException(
      `${field} config is required for ${label} monitors`,
    );
  }

  const host = input.host.trim();
  if (!isValidTcpHost(host)) {
    throw new BadRequestException(
      `${label} host must be a hostname or IP address`,
    );
  }

  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    throw new BadRequestException(`${label} port must be between 1 and 65535`);
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

export function hasMonitorConfigUpdate(input: MonitorConfigInputs): boolean {
  return presentConfigFields(input).length > 0;
}
