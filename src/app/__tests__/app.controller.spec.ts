import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from '../../health/health.service';
import { AppController } from '../app.controller';

const healthPayload = {
  status: 'ok',
  database: 'connected',
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('AppController', () => {
  let controller: AppController;
  let check: jest.Mock;

  beforeEach(async () => {
    check = jest.fn().mockResolvedValue(healthPayload);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: HealthService,
          useValue: { check },
        },
      ],
    }).compile();

    controller = module.get(AppController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /health', () => {
    it('returns the health payload from HealthService', async () => {
      await expect(controller.getHealth()).resolves.toEqual(healthPayload);
      expect(check).toHaveBeenCalledTimes(1);
    });

    it('propagates HealthService errors', async () => {
      check.mockRejectedValue(new Error('unavailable'));

      await expect(controller.getHealth()).rejects.toThrow('unavailable');
    });
  });
});
