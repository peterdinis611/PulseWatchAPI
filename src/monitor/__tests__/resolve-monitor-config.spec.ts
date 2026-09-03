import { BadRequestException } from '@nestjs/common';
import { MonitorType } from '../monitor-type';
import { resolveMonitorConfig } from '../resolve-monitor-config';

describe('resolveMonitorConfig', () => {
  it('builds an HTTP config with defaults', () => {
    expect(
      resolveMonitorConfig(MonitorType.HTTP, {
        http: { url: 'https://example.com/health' },
      }),
    ).toEqual({
      url: 'https://example.com/health',
      method: 'GET',
      expectedStatus: 200,
    });
  });

  it('rejects HTTP monitors without http config', () => {
    expect(() => resolveMonitorConfig(MonitorType.HTTP, {})).toThrow(
      BadRequestException,
    );
  });

  it('builds Redis, database and TCP configs', () => {
    expect(
      resolveMonitorConfig(MonitorType.REDIS, {
        redis: { url: 'redis://localhost:6379' },
      }),
    ).toEqual({ url: 'redis://localhost:6379' });

    expect(
      resolveMonitorConfig(MonitorType.DATABASE, {
        database: { url: 'file:./data/test.sqlite' },
      }),
    ).toEqual({ url: 'file:./data/test.sqlite' });

    expect(
      resolveMonitorConfig(MonitorType.TCP, {
        tcp: { host: '127.0.0.1', port: 4000 },
      }),
    ).toEqual({ host: '127.0.0.1', port: 4000 });

    expect(
      resolveMonitorConfig(MonitorType.SSL, {
        ssl: { host: 'example.com', port: 443 },
      }),
    ).toEqual({
      host: 'example.com',
      port: 443,
      minDaysUntilExpiry: 0,
      allowUnauthorized: false,
    });
  });

  it('builds DNS, SMTP, Kafka and gRPC configs', () => {
    expect(
      resolveMonitorConfig(MonitorType.DNS, {
        dns: { host: 'example.com', recordType: 'MX', expectedValue: 'mail' },
      }),
    ).toEqual({
      host: 'example.com',
      recordType: 'MX',
      expectedValue: 'mail',
    });

    expect(
      resolveMonitorConfig(MonitorType.SMTP, {
        smtp: { host: 'smtp.example.com', port: 587, startTls: true },
      }),
    ).toEqual({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      startTls: true,
      allowUnauthorized: false,
    });

    expect(
      resolveMonitorConfig(MonitorType.KAFKA, {
        kafka: {
          host: 'kafka.internal',
          port: 9092,
          topic: 'events',
          tls: true,
        },
      }),
    ).toEqual({
      host: 'kafka.internal',
      port: 9092,
      tls: true,
      topic: 'events',
    });

    expect(
      resolveMonitorConfig(MonitorType.GRPC, {
        grpc: { host: 'api.internal', port: 50051, service: 'pulse.v1.Api' },
      }),
    ).toEqual({
      host: 'api.internal',
      port: 50051,
      tls: false,
      service: 'pulse.v1.Api',
      allowUnauthorized: false,
    });
  });

  it('rejects SMTP secure+STARTTLS and a hostname nameserver', () => {
    expect(() =>
      resolveMonitorConfig(MonitorType.SMTP, {
        smtp: {
          host: 'smtp.example.com',
          port: 465,
          secure: true,
          startTls: true,
        },
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      resolveMonitorConfig(MonitorType.DNS, {
        dns: { host: 'example.com', nameserver: 'dns.example.com' },
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects extra config, empty SQLite paths and invalid TCP hosts', () => {
    expect(() =>
      resolveMonitorConfig(MonitorType.HTTP, {
        http: { url: 'https://example.com/health' },
        redis: { url: 'redis://localhost:6379' },
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      resolveMonitorConfig(MonitorType.DATABASE, {
        database: { url: 'file:' },
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      resolveMonitorConfig(MonitorType.TCP, {
        tcp: { host: 'example.com:80', port: 80 },
      }),
    ).toThrow(BadRequestException);
  });

  it('builds an SSL config with SNI and expiry floor', () => {
    expect(
      resolveMonitorConfig(MonitorType.SSL, {
        ssl: {
          host: '127.0.0.1',
          port: 443,
          serverName: 'api.example.com',
          minDaysUntilExpiry: 14,
          allowUnauthorized: true,
        },
      }),
    ).toEqual({
      host: '127.0.0.1',
      port: 443,
      serverName: 'api.example.com',
      minDaysUntilExpiry: 14,
      allowUnauthorized: true,
    });
  });
});
