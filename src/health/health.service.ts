import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { HealthPayload } from './health.model';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async check(): Promise<HealthPayload> {
    let database = 'disconnected';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'connected';
      this.logger.debug('SQLite health check ok', HealthService.name);
    } catch (error) {
      database = 'error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        'SQLite health check failed',
        stack,
        HealthService.name,
      );
    }

    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
