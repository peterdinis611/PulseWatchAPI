import { MonitorAlertService } from '../monitor-alert.service';
import { createTestMonitorSettings } from './create-test-monitor-settings';

describe('MonitorAlertService', () => {
  const service = new MonitorAlertService({ monitor: { update: jest.fn() } } as never);

  it('blocks alerts when monitor is muted', () => {
    expect(
      service.shouldNotify(
        {
          id: 'm-1',
          alertsMuted: true,
          lastDownNotifiedAt: null,
          lastRecoverNotifiedAt: null,
        },
        createTestMonitorSettings(),
        'down',
      ),
    ).toBe(false);
  });

  it('blocks alerts during fleet maintenance', () => {
    expect(
      service.shouldNotify(
        {
          id: 'm-1',
          alertsMuted: false,
          lastDownNotifiedAt: null,
          lastRecoverNotifiedAt: null,
        },
        createTestMonitorSettings({
          maintenanceUntil: new Date(Date.now() + 60_000),
        }),
        'down',
      ),
    ).toBe(false);
  });

  it('applies cooldown between repeated down alerts', () => {
    expect(
      service.shouldNotify(
        {
          id: 'm-1',
          alertsMuted: false,
          lastDownNotifiedAt: new Date(),
          lastRecoverNotifiedAt: null,
        },
        createTestMonitorSettings(),
        'down',
      ),
    ).toBe(false);
  });
});
