import { isMonitorDue } from '../monitor-config';

describe('isMonitorDue', () => {
  it('is due when it has never been checked', () => {
    expect(isMonitorDue({ lastCheckedAt: null, intervalSec: 60 })).toBe(true);
  });

  it('is due when the interval has elapsed', () => {
    expect(
      isMonitorDue(
        {
          lastCheckedAt: new Date('2026-01-01T00:00:00.000Z'),
          intervalSec: 60,
        },
        Date.parse('2026-01-01T00:01:00.000Z'),
      ),
    ).toBe(true);
  });

  it('is not due before the interval elapses', () => {
    expect(
      isMonitorDue(
        {
          lastCheckedAt: new Date('2026-01-01T00:00:00.000Z'),
          intervalSec: 60,
        },
        Date.parse('2026-01-01T00:00:59.000Z'),
      ),
    ).toBe(false);
  });
});
