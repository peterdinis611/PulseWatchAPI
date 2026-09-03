import { Test, TestingModule } from '@nestjs/testing';
import type { PublicUser } from '../../user/public-user';
import { MonitorResolver } from '../monitor.resolver';
import { MonitorCheckHistoryService } from '../monitor-check-history.service';
import { MonitorService } from '../monitor.service';
import { MonitorSettingsService } from '../monitor-settings.service';
import { MonitorStatus } from '../monitor-status';
import { MonitorType } from '../monitor-type';

describe('MonitorResolver', () => {
  let resolver: MonitorResolver;
  let listForUser: jest.Mock;
  let findForUser: jest.Mock;
  let createForUser: jest.Mock;
  let updateForUser: jest.Mock;
  let deleteForUser: jest.Mock;
  let checkForUser: jest.Mock;
  let probeForUser: jest.Mock;
  let quickCheckForUser: jest.Mock;
  let getForUser: jest.Mock;
  let updateForUserSettings: jest.Mock;

  const user: PublicUser = {
    id: 'user-1',
    email: 'ada@pulsewatch.dev',
    name: 'Ada',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const view = {
    id: 'm-1',
    name: 'API',
    type: MonitorType.HTTP,
    enabled: true,
    intervalSec: 60,
    timeoutMs: 10000,
    config: { url: 'https://example.com/health' },
    lastStatus: MonitorStatus.UNKNOWN,
    lastError: null,
    lastLatencyMs: null,
    lastCheckedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    listForUser = jest.fn().mockResolvedValue([view]);
    findForUser = jest.fn().mockResolvedValue(view);
    createForUser = jest.fn().mockResolvedValue(view);
    updateForUser = jest.fn().mockResolvedValue(view);
    deleteForUser = jest.fn().mockResolvedValue(true);
    checkForUser = jest.fn().mockResolvedValue(view);
    probeForUser = jest.fn().mockResolvedValue({
      status: MonitorStatus.UP,
      error: null,
      latencyMs: 12,
      checkedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    quickCheckForUser = jest.fn().mockResolvedValue({
      status: MonitorStatus.DOWN,
      error: 'timeout',
      latencyMs: 10000,
      checkedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    getForUser = jest.fn().mockResolvedValue({
      defaultIntervalSec: 60,
      defaultTimeoutMs: 10000,
      notifyOnDown: true,
      notifyOnRecover: true,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    updateForUserSettings = jest.fn().mockResolvedValue({
      defaultIntervalSec: 30,
      defaultTimeoutMs: 5000,
      notifyOnDown: false,
      notifyOnRecover: true,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorResolver,
        {
          provide: MonitorService,
          useValue: {
            listForUser,
            findForUser,
            createForUser,
            updateForUser,
            deleteForUser,
            checkForUser,
            probeForUser,
            quickCheckForUser,
          },
        },
        {
          provide: MonitorSettingsService,
          useValue: {
            getForUser,
            updateForUser: updateForUserSettings,
          },
        },
        {
          provide: MonitorCheckHistoryService,
          useValue: {
            listForMonitor: jest.fn().mockResolvedValue([]),
            uptimeForMonitor: jest.fn().mockResolvedValue({
              periodHours: 24,
              totalChecks: 0,
              upChecks: 0,
              uptimePercent: 100,
              avgLatencyMs: null,
            }),
          },
        },
      ],
    }).compile();

    resolver = module.get(MonitorResolver);
  });

  it('lists monitors', async () => {
    await expect(resolver.monitors(user)).resolves.toEqual([view]);
  });

  it('loads a monitor', async () => {
    await expect(resolver.monitor(user, 'm-1')).resolves.toEqual(view);
  });

  it('creates a monitor', async () => {
    const input = { name: 'API', type: MonitorType.HTTP };
    await expect(resolver.createMonitor(user, input)).resolves.toEqual(view);
    expect(createForUser).toHaveBeenCalledWith('user-1', input);
  });

  it('updates, checks and deletes a monitor', async () => {
    await resolver.updateMonitor(user, 'm-1', { name: 'API' });
    await resolver.runMonitorCheck(user, 'm-1');
    await expect(resolver.deleteMonitor(user, 'm-1')).resolves.toBe(true);
    expect(updateForUser).toHaveBeenCalledWith('user-1', 'm-1', {
      name: 'API',
    });
    expect(checkForUser).toHaveBeenCalledWith('user-1', 'm-1');
    expect(deleteForUser).toHaveBeenCalledWith('user-1', 'm-1');
  });

  it('probes and quick-checks monitors without persisting', async () => {
    const input = {
      name: 'API',
      type: MonitorType.HTTP,
      http: { url: 'https://example.com/health' },
    };

    await expect(resolver.probeMonitor(user, input)).resolves.toEqual(
      expect.objectContaining({ status: MonitorStatus.UP, latencyMs: 12 }),
    );
    await expect(
      resolver.quickMonitorCheck(user, 'm-1', { http: input.http }),
    ).resolves.toEqual(
      expect.objectContaining({ status: MonitorStatus.DOWN, error: 'timeout' }),
    );
    expect(probeForUser).toHaveBeenCalledWith('user-1', input);
    expect(quickCheckForUser).toHaveBeenCalledWith('user-1', 'm-1', {
      http: input.http,
    });
  });

  it('loads and updates per-user monitor settings', async () => {
    await expect(resolver.monitorSettings(user)).resolves.toEqual(
      expect.objectContaining({ defaultIntervalSec: 60, notifyOnDown: true }),
    );
    await resolver.updateMonitorSettings(user, {
      defaultIntervalSec: 30,
      notifyOnDown: false,
    });
    expect(getForUser).toHaveBeenCalledWith('user-1');
    expect(updateForUserSettings).toHaveBeenCalledWith('user-1', {
      defaultIntervalSec: 30,
      notifyOnDown: false,
    });
  });
});
