import { Controller, Get } from '@nestjs/common';
import { HealthPayload } from './health/health.model';
import { HealthService } from './health/health.service';

@Controller()
export class AppController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  getHealth(): Promise<HealthPayload> {
    return this.healthService.check();
  }
}
