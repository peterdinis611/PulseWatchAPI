import {
  formatProbeError,
  isMonitorDue,
  sanitizeErrorMessage,
} from '../monitor-config';

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

describe('formatProbeError', () => {
  it('maps common network failures to stable messages', () => {
    const timeout = new Error('aborted');
    timeout.name = 'TimeoutError';
    expect(formatProbeError(timeout)).toBe('Request timed out');

    const refused = new Error('connect ECONNREFUSED') as NodeJS.ErrnoException;
    refused.code = 'ECONNREFUSED';
    expect(formatProbeError(refused)).toBe('Connection refused');

    const wrapped = new Error('fetch failed');
    (wrapped as Error & { cause: NodeJS.ErrnoException }).cause = Object.assign(
      new Error('getaddrinfo ENOTFOUND'),
      { code: 'ENOTFOUND' },
    );
    expect(formatProbeError(wrapped)).toBe('Host could not be resolved');
  });

  it('strips credentials from error text', () => {
    expect(
      sanitizeErrorMessage(
        'connect postgres://ada:secret@db:5432/app failed password=hunter2',
      ),
    ).toBe('connect postgres://***:***@db:5432/app failed password=***');
  });
});
