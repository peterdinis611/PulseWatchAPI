import { connect as netConnect, isIP } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { DatabaseSync } from 'node:sqlite';
import { Injectable } from '@nestjs/common';
import mysql from 'mysql2/promise';
import { Client } from 'pg';
import { createClient } from 'redis';
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
