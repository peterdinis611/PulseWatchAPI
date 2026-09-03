import { MonitorType } from '../monitor-type';
import { validateMonitorTypeConfig } from '../validate-monitor-type-config';

describe('validateMonitorTypeConfig', () => {
  it('requires the matching config on create', () => {
    expect(validateMonitorTypeConfig(MonitorType.HTTP, {}, true)).toBe(
      'http config is required for HTTP monitors',
    );
  });

  it('rejects extra config blocks', () => {
    expect(
      validateMonitorTypeConfig(
        MonitorType.HTTP,
        {
          http: { url: 'https://example.com' },
          redis: { url: 'redis://localhost:6379' },
        },
        true,
      ),
    ).toBe('HTTP monitors cannot include redis config');
  });

  it('allows a matching gRPC config', () => {
    expect(
      validateMonitorTypeConfig(
        MonitorType.GRPC,
        { grpc: { host: '127.0.0.1', port: 50051 } },
        true,
      ),
    ).toBeNull();
  });

  it('allows updates without config when not required', () => {
    expect(validateMonitorTypeConfig(MonitorType.HTTP, {}, false)).toBeNull();
  });
});
