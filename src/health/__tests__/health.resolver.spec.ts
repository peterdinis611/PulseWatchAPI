import { Test, TestingModule } from '@nestjs/testing';
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

  beforeEach(async () => {
    check = jest.fn().mockResolvedValue(healthPayload);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthResolver,
        {
          provide: HealthService,
          useValue: { check },
        },
      ],
    }).compile();

    resolver = module.get(HealthResolver);
  });

  it('is defined', () => {
    expect(resolver).toBeDefined();
  });

  it('returns the health payload from HealthService', async () => {
    await expect(resolver.health()).resolves.toEqual(healthPayload);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('propagates HealthService errors', async () => {
    check.mockRejectedValue(new Error('unavailable'));

    await expect(resolver.health()).rejects.toThrow('unavailable');
  });
});
