import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { HealthService } from './health/health.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            check: jest.fn().mockResolvedValue({
              status: 'ok',
              database: 'connected',
              timestamp: '2026-01-01T00:00:00.000Z',
            }),
          },
        },
      ],
    }).compile();

    appController = app.get(AppController);
  });

  describe('GET /health', () => {
    it('returns health payload', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        database: 'connected',
        timestamp: '2026-01-01T00:00:00.000Z',
      });
    });
  });
});
