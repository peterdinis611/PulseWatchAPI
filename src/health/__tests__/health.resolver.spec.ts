import { Test, TestingModule } from '@nestjs/testing';
import { HEALTH_UPDATED } from '../../pubsub/pubsub.events';
import { PubSubService } from '../../pubsub/pubsub.service';
import { HealthPayload } from '../health.model';
import { HealthResolver } from '../health.resolver';
import { HealthService } from '../health.service';

const healthPayload: HealthPayload = {
  status: 'ok',
  database: 'connected',
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('HealthResolver', () => {
  let resolver: HealthResolver;
  let check: jest.Mock;
  let publish: jest.Mock;
  let asyncIterator: jest.Mock;

  beforeEach(async () => {
    check = jest.fn().mockResolvedValue(healthPayload);
    publish = jest.fn().mockResolvedValue(undefined);
    asyncIterator = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthResolver,
        {
          provide: HealthService,
          useValue: { check },
        },
        {
          provide: PubSubService,
          useValue: { publish, asyncIterator },
        },
      ],
    }).compile();

    resolver = module.get(HealthResolver);
  });

  it('is defined', () => {
    expect(resolver).toBeDefined();
  });

  it('returns the health payload and publishes healthUpdated', async () => {
    await expect(resolver.health()).resolves.toEqual(healthPayload);
    expect(check).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(HEALTH_UPDATED, {
      healthUpdated: healthPayload,
    });
  });

  it('propagates HealthService errors without publishing', async () => {
    check.mockRejectedValue(new Error('unavailable'));

    await expect(resolver.health()).rejects.toThrow('unavailable');
    expect(publish).not.toHaveBeenCalled();
  });

  it('subscribes to healthUpdated via PubSub', () => {
    const iterator = {} as AsyncIterableIterator<{
      healthUpdated: HealthPayload;
    }>;
    asyncIterator.mockReturnValue(iterator);

    expect(resolver.healthUpdated()).toBe(iterator);
    expect(asyncIterator).toHaveBeenCalledWith(HEALTH_UPDATED);
  });
});
