import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthService } from '../health.service';

describe('HealthService', () => {
  let service: HealthService;
  let queryRaw: jest.Mock;
  let debug: jest.Mock;
  let error: jest.Mock;

  beforeEach(async () => {
    queryRaw = jest.fn().mockResolvedValue([{ 1: 1 }]);
    debug = jest.fn();
    error = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: { $queryRaw: queryRaw },
        },
        {
          provide: LoggerService,
          useValue: { debug, error },
        },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('returns ok when SQLite responds', async () => {
    const result = await service.check();

    expect(queryRaw).toHaveBeenCalled();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(result.timestamp).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    expect(debug).toHaveBeenCalledWith(
      'SQLite health check ok',
      HealthService.name,
    );
  });

  it('returns degraded when SQLite fails', async () => {
    queryRaw.mockRejectedValue(new Error('db down'));

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.database).toBe('error');
    expect(result.timestamp).toEqual(expect.any(String));
    expect(error).toHaveBeenCalledWith(
      'SQLite health check failed',
      expect.any(String),
      HealthService.name,
    );
  });
});
