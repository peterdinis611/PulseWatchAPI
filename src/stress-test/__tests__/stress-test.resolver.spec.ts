import { Test, TestingModule } from '@nestjs/testing';
import type { PublicUser } from '../../user/public-user';
import { StressTestResolver } from '../stress-test.resolver';
import { StressTestService } from '../stress-test.service';
import { StressTestStatus } from '../stress-test-status';

describe('StressTestResolver', () => {
  let resolver: StressTestResolver;
  let listForUser: jest.Mock;
  let findForUser: jest.Mock;
  let listRunsForUser: jest.Mock;
  let createForUser: jest.Mock;
  let updateForUser: jest.Mock;
  let deleteForUser: jest.Mock;
  let runForUser: jest.Mock;

  const user: PublicUser = {
    id: 'user-1',
    email: 'ada@pulsewatch.dev',
    name: 'Ada',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const view = {
    id: 'st-1',
    name: 'API load',
    url: 'https://example.com',
    method: 'GET',
    vus: 10,
    durationSec: 30,
    expectedStatus: 200,
    p95Ms: null,
    maxFailRate: null,
    lastStatus: StressTestStatus.IDLE,
    lastError: null,
    lastSummary: null,
    lastRunAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    listForUser = jest.fn().mockResolvedValue([view]);
    findForUser = jest.fn().mockResolvedValue(view);
    listRunsForUser = jest.fn().mockResolvedValue([]);
    createForUser = jest.fn().mockResolvedValue(view);
    updateForUser = jest.fn().mockResolvedValue(view);
    deleteForUser = jest.fn().mockResolvedValue(true);
    runForUser = jest.fn().mockResolvedValue({
      ...view,
      lastStatus: StressTestStatus.RUNNING,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StressTestResolver,
        {
          provide: StressTestService,
          useValue: {
            listForUser,
            findForUser,
            listRunsForUser,
            createForUser,
            updateForUser,
            deleteForUser,
            runForUser,
          },
        },
      ],
    }).compile();

    resolver = module.get(StressTestResolver);
  });

  it('lists stress tests', async () => {
    await expect(resolver.stressTests(user)).resolves.toEqual([view]);
  });

  it('loads a stress test and its runs', async () => {
    await expect(resolver.stressTest(user, 'st-1')).resolves.toEqual(view);
    await expect(resolver.stressTestRuns(user, 'st-1')).resolves.toEqual([]);
  });

  it('creates, updates, runs and deletes', async () => {
    const input = { name: 'API load', url: 'https://example.com' };
    await expect(resolver.createStressTest(user, input)).resolves.toEqual(view);
    await resolver.updateStressTest(user, 'st-1', { name: 'API load' });
    await resolver.runStressTest(user, 'st-1');
    await expect(resolver.deleteStressTest(user, 'st-1')).resolves.toBe(true);
    expect(createForUser).toHaveBeenCalledWith('user-1', input);
    expect(runForUser).toHaveBeenCalledWith('user-1', 'st-1');
  });
});
