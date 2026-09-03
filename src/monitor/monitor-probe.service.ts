import { Resolver } from 'node:dns/promises';
import { connect as netConnect, isIP, type Socket } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import { Injectable } from '@nestjs/common';
import mysql from 'mysql2/promise';
import { Kafka, logLevel } from 'kafkajs';
import { Client } from 'pg';
import { createClient } from 'redis';
import { DnsRecordType } from './dns-record-type';
import { createGrpcHealthClient } from './grpc-health';
import {
  clampTimeoutMs,
  formatProbeError,
  MonitorConfigValue,
} from './monitor-config';
import { DEFAULT_TIMEOUT_MS, MONITOR_USER_AGENT } from './monitor.constants';
import { MonitorStatus } from './monitor-status';
import { MonitorType } from './monitor-type';

export type ProbeResult = {
  status: MonitorStatus;
  error: string | null;
  latencyMs: number;
};

@Injectable()
export class MonitorProbeService {
  async probe(
    type: MonitorType,
    config: MonitorConfigValue,
    timeoutMs: number,
  ): Promise<ProbeResult> {
    const timeout = clampTimeoutMs(timeoutMs, DEFAULT_TIMEOUT_MS);
    const started = Date.now();

    try {
      switch (type) {
        case MonitorType.HTTP:
          await this.probeHttp(config, timeout);
          break;
        case MonitorType.REDIS:
          await this.probeRedis(config, timeout);
          break;
        case MonitorType.DATABASE:
          await this.probeDatabase(config, timeout);
          break;
        case MonitorType.TCP:
          await this.probeTcp(config, timeout);
          break;
        case MonitorType.SSL:
          await this.probeSsl(config, timeout);
          break;
        case MonitorType.DNS:
          await this.probeDns(config, timeout);
          break;
        case MonitorType.SMTP:
          await this.probeSmtp(config, timeout);
          break;
        case MonitorType.KAFKA:
          await this.probeKafka(config, timeout);
          break;
        case MonitorType.GRPC:
          await this.probeGrpc(config, timeout);
          break;
        default:
          throw new Error(`Unsupported monitor type: ${String(type)}`);
      }

      return {
        status: MonitorStatus.UP,
        error: null,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      return {
        status: MonitorStatus.DOWN,
        error: formatProbeError(error),
        latencyMs: Date.now() - started,
      };
    }
  }

  private async probeHttp(
    config: MonitorConfigValue,
    timeoutMs: number,
  ): Promise<void> {
    if (!config.url) {
      throw new Error('HTTP monitor is missing a URL');
    }

    const response = await fetch(config.url, {
      method: config.method ?? 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': MONITOR_USER_AGENT },
    });

    const expected = config.expectedStatus ?? 200;
    if (response.status !== expected) {
      throw new Error(`Expected HTTP ${expected}, received ${response.status}`);
    }
  }

  private async probeRedis(
    config: MonitorConfigValue,
    timeoutMs: number,
  ): Promise<void> {
    if (!config.url) {
      throw new Error('Redis monitor is missing a URL');
    }

    const client = createClient({
      url: config.url,
      socket: {
        connectTimeout: timeoutMs,
        reconnectStrategy: false,
      },
    });
    client.on('error', () => undefined);

    try {
      await withTimeout(
        (async () => {
          await client.connect();
          await client.ping();
        })(),
        timeoutMs,
        'Redis connection timed out',
      );
    } finally {
      if (client.isOpen) {
        await client.close().catch(() => undefined);
      }
    }
  }

  private async probeDatabase(
    config: MonitorConfigValue,
    timeoutMs: number,
  ): Promise<void> {
    if (!config.url) {
      throw new Error('Database monitor is missing a URL');
    }

    const url = config.url;
    const lower = url.toLowerCase();

    if (lower.startsWith('postgres://') || lower.startsWith('postgresql://')) {
      const client = new Client({
        connectionString: url,
        connectionTimeoutMillis: timeoutMs,
        query_timeout: timeoutMs,
        statement_timeout: timeoutMs,
      });
      try {
        await withTimeout(
          (async () => {
            await client.connect();
            await client.query('SELECT 1');
          })(),
          timeoutMs,
          'Database connection timed out',
        );
      } finally {
        await client.end().catch(() => undefined);
      }
      return;
    }

    if (lower.startsWith('mysql://') || lower.startsWith('mysql2://')) {
      const uri = url.replace(/^mysql2:\/\//i, 'mysql://');
      const connection = await withTimeout(
        mysql.createConnection({
          uri,
          connectTimeout: timeoutMs,
        }),
        timeoutMs,
        'Database connection timed out',
      );
      try {
        await withTimeout(
          connection.query('SELECT 1'),
          timeoutMs,
          'Database query timed out',
        );
      } finally {
        await connection.end().catch(() => undefined);
      }
      return;
    }

    if (lower.startsWith('file:') || lower.startsWith('sqlite:')) {
      const path = url.replace(/^(file:|sqlite:)/i, '');
      if (!path) {
        throw new Error('SQLite path is required');
      }
      const database = new DatabaseSync(path, { timeout: timeoutMs });
      try {
        database.prepare('SELECT 1').get();
      } finally {
        database.close();
      }
      return;
    }

    throw new Error('Unsupported database URL');
  }

  private probeTcp(
    config: MonitorConfigValue,
    timeoutMs: number,
  ): Promise<void> {
    const host = config.host;
    const port = config.port;
    if (!host || port == null) {
      return Promise.reject(new Error('TCP monitor is missing host or port'));
    }

    return new Promise((resolve, reject) => {
      const socket = netConnect({ host, port });
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.removeAllListeners();
        socket.destroy();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      };

      socket.setTimeout(timeoutMs, () => {
        finish(new Error(`TCP connection to ${host}:${port} timed out`));
      });
      socket.once('connect', () => finish());
      socket.once('error', (error) => finish(error));
    });
  }

  private probeSsl(
    config: MonitorConfigValue,
    timeoutMs: number,
  ): Promise<void> {
    const host = config.host;
    const port = config.port;
    if (!host || port == null) {
      return Promise.reject(new Error('SSL monitor is missing host or port'));
    }

    const servername =
      config.serverName?.trim() || (isIP(host) ? undefined : host);
    const minDaysUntilExpiry = config.minDaysUntilExpiry ?? 0;
    const rejectUnauthorized = config.allowUnauthorized !== true;

    return new Promise((resolve, reject) => {
      const socket = tlsConnect({
        host,
        port,
        servername,
        rejectUnauthorized,
      });
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.removeAllListeners();
        socket.destroy();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      };

      socket.setTimeout(timeoutMs, () => {
        finish(new Error(`TLS connection to ${host}:${port} timed out`));
      });
      socket.once('secureConnect', () => {
        if (rejectUnauthorized && !socket.authorized) {
          finish(
            socket.authorizationError instanceof Error
              ? socket.authorizationError
              : new Error('TLS certificate error'),
          );
          return;
        }

        const cert = socket.getPeerCertificate();
        if (!cert || Object.keys(cert).length === 0) {
          finish(new Error('No TLS certificate presented'));
          return;
        }

        const validTo = cert.valid_to ? Date.parse(cert.valid_to) : Number.NaN;
        if (!Number.isFinite(validTo)) {
          finish(new Error('TLS certificate expiry is missing'));
          return;
        }

        const daysLeft = (validTo - Date.now()) / 86_400_000;
        if (daysLeft < 0) {
          finish(new Error('TLS certificate has expired'));
          return;
        }
        if (minDaysUntilExpiry > 0 && daysLeft < minDaysUntilExpiry) {
          finish(
            new Error(
              `TLS certificate expires in ${Math.floor(daysLeft)} days (minimum ${minDaysUntilExpiry})`,
            ),
          );
          return;
        }

        finish();
      });
      socket.once('error', (error) => finish(error));
    });
  }

  private async probeDns(
    config: MonitorConfigValue,
    timeoutMs: number,
  ): Promise<void> {
    if (!config.host) {
      throw new Error('DNS monitor is missing a hostname');
    }

    const recordType = (config.recordType ?? DnsRecordType.A) as DnsRecordType;
    const resolver = new Resolver();
    if (config.nameserver) {
      resolver.setServers([dnsServer(config.nameserver)]);
    }

    const records = await withTimeout(
      resolveDnsRecords(resolver, config.host, recordType),
      timeoutMs,
      'DNS lookup timed out',
    );
    if (records.length === 0) {
      throw new Error(`No ${recordType} records for ${config.host}`);
    }

    const expected = config.expectedValue?.trim().toLowerCase();
    if (
      expected &&
      !records.some((value) => value.toLowerCase().includes(expected))
    ) {
      throw new Error(
        `DNS ${recordType} for ${config.host} did not include ${config.expectedValue}`,
      );
    }
  }

  private async probeSmtp(
    config: MonitorConfigValue,
    timeoutMs: number,
  ): Promise<void> {
    const host = config.host;
    const port = config.port;
    if (!host || port == null) {
      throw new Error('SMTP monitor is missing host or port');
    }

    let socket: Socket | TLSSocket = await connectSocket({
      host,
      port,
      timeoutMs,
      tls: config.secure === true,
      allowUnauthorized: config.allowUnauthorized === true,
    });

    try {
      await readSmtpReply(socket, 220, timeoutMs);
      await writeSmtp(socket, 'EHLO pulsewatch.local');
      await readSmtpReply(socket, 250, timeoutMs);

      if (config.startTls) {
        await writeSmtp(socket, 'STARTTLS');
        await readSmtpReply(socket, 220, timeoutMs);
        socket = await upgradeToTls(
          socket,
          host,
          timeoutMs,
          config.allowUnauthorized === true,
        );
        await writeSmtp(socket, 'EHLO pulsewatch.local');
        await readSmtpReply(socket, 250, timeoutMs);
      }

      await writeSmtp(socket, 'QUIT');
      await readSmtpReply(socket, 221, timeoutMs).catch(() => undefined);
    } finally {
      socket.destroy();
    }
  }

  private async probeKafka(
    config: MonitorConfigValue,
    timeoutMs: number,
  ): Promise<void> {
    const host = config.host;
    const port = config.port;
    if (!host || port == null) {
      throw new Error('Kafka monitor is missing host or port');
    }

    const kafka = new Kafka({
      clientId: 'pulsewatch',
      brokers: [`${host}:${port}`],
      ssl: config.tls === true,
      connectionTimeout: timeoutMs,
      requestTimeout: timeoutMs,
      retry: { retries: 0, initialRetryTime: 1, maxRetryTime: 1 },
      logLevel: logLevel.NOTHING,
    });
    const admin = kafka.admin();

    try {
      await withTimeout(
        admin.connect(),
        timeoutMs,
        'Kafka connection timed out',
      );
      const topics = await withTimeout(
        admin.listTopics(),
        timeoutMs,
        'Kafka metadata timed out',
      );
      if (config.topic && !topics.includes(config.topic)) {
        throw new Error(`Kafka topic ${config.topic} was not found`);
      }
    } finally {
      await admin.disconnect().catch(() => undefined);
    }
  }

  private async probeGrpc(
    config: MonitorConfigValue,
    timeoutMs: number,
  ): Promise<void> {
    const host = config.host;
    const port = config.port;
    if (!host || port == null) {
      throw new Error('gRPC monitor is missing host or port');
    }

    const client = createGrpcHealthClient(
      `${host}:${port}`,
      config.tls === true,
      config.allowUnauthorized === true,
    );

    try {
      const response = await withTimeout(
        new Promise<{ status?: string | number }>((resolve, reject) => {
          client.check(
            { service: config.service ?? '' },
            { deadline: Date.now() + timeoutMs },
            (error, result) => {
              if (error) {
                reject(error);
                return;
              }
              resolve(result ?? {});
            },
          );
        }),
        timeoutMs,
        'gRPC health check timed out',
      );

      const status = String(response.status ?? 'UNKNOWN');
      if (status !== 'SERVING' && status !== '1') {
        throw new Error(`gRPC health is ${status}`);
      }
    } finally {
      client.close();
    }
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

function dnsServer(nameserver: string): string {
  return isIP(nameserver) === 6 ? `[${nameserver}]:53` : `${nameserver}:53`;
}

async function resolveDnsRecords(
  resolver: Resolver,
  host: string,
  recordType: DnsRecordType,
): Promise<string[]> {
  switch (recordType) {
    case DnsRecordType.A:
      return resolver.resolve4(host);
    case DnsRecordType.AAAA:
      return resolver.resolve6(host);
    case DnsRecordType.CNAME:
      return resolver.resolveCname(host);
    case DnsRecordType.NS:
      return resolver.resolveNs(host);
    case DnsRecordType.MX:
      return (await resolver.resolveMx(host)).map((record) => record.exchange);
    case DnsRecordType.TXT:
      return (await resolver.resolveTxt(host)).map((chunks) => chunks.join(''));
    default:
      throw new Error(`Unsupported DNS record type: ${String(recordType)}`);
  }
}

function connectSocket(options: {
  host: string;
  port: number;
  timeoutMs: number;
  tls: boolean;
  allowUnauthorized: boolean;
}): Promise<Socket | TLSSocket> {
  const { host, port, timeoutMs, tls, allowUnauthorized } = options;
  return new Promise((resolve, reject) => {
    const socket = tls
      ? tlsConnect({
          host,
          port,
          servername: isIP(host) ? undefined : host,
          rejectUnauthorized: !allowUnauthorized,
        })
      : netConnect({ host, port });
    const finish = (error?: Error) => {
      socket.removeAllListeners();
      if (error) {
        socket.destroy();
        reject(error);
        return;
      }
      resolve(socket);
    };
    socket.setTimeout(timeoutMs, () => {
      finish(new Error(`SMTP connection to ${host}:${port} timed out`));
    });
    socket.once(tls ? 'secureConnect' : 'connect', () => finish());
    socket.once('error', (error) => finish(error));
  });
}

function upgradeToTls(
  socket: Socket,
  host: string,
  timeoutMs: number,
  allowUnauthorized: boolean,
): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const tlsSocket = tlsConnect({
      socket,
      host,
      servername: isIP(host) ? undefined : host,
      rejectUnauthorized: !allowUnauthorized,
    });
    const finish = (error?: Error) => {
      tlsSocket.removeAllListeners();
      if (error) {
        tlsSocket.destroy();
        reject(error);
        return;
      }
      resolve(tlsSocket);
    };
    tlsSocket.setTimeout(timeoutMs, () => {
      finish(new Error('SMTP STARTTLS timed out'));
    });
    tlsSocket.once('secureConnect', () => finish());
    tlsSocket.once('error', (error) => finish(error));
  });
}

function writeSmtp(socket: Socket, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(`${line}\r\n`, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function readSmtpReply(
  socket: Socket,
  expectedCode: number,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('SMTP response timed out'));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      if (!buffer.endsWith('\n') && !buffer.endsWith('\r\n')) {
        buffer = lines.pop() ?? '';
      } else {
        buffer = '';
        lines.pop();
      }

      for (const line of lines) {
        const match = /^(\d{3})([ -])/.exec(line);
        if (!match) {
          continue;
        }
        const code = Number(match[1]);
        const last = match[2] === ' ';
        if (!last) {
          continue;
        }
        cleanup();
        if (code !== expectedCode) {
          reject(new Error(`Expected SMTP ${expectedCode}, received ${code}`));
          return;
        }
        resolve();
        return;
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
    };

    socket.on('data', onData);
    socket.once('error', onError);
  });
}
