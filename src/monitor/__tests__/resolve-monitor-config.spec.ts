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
});
