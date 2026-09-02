import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let queryRaw: jest.Mock;

  beforeEach(async () => {
    queryRaw = jest.fn().mockResolvedValue([{ 1: 1 }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: { $queryRaw: queryRaw },
        },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('returns ok when SQLite responds', async () => {
    const result = await service.check();

    expect(queryRaw).toHaveBeenCalled();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(result.timestamp).toEqual(expect.any(String));
  });

  it('returns degraded when SQLite fails', async () => {
    queryRaw.mockRejectedValue(new Error('db down'));

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.database).toBe('error');
  });
});
