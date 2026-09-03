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

  it('rejects a Redis URL that is not redis://', () => {
    expect(() =>
      resolveMonitorConfig(MonitorType.REDIS, {
        redis: { url: 'http://localhost:6379' },
      }),
    ).toThrow(BadRequestException);
  });
});
