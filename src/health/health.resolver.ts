import { Query, Resolver } from '@nestjs/graphql';
import { HealthPayload } from './health.model';
import { HealthService } from './health.service';

@Resolver()
export class HealthResolver {
  constructor(private readonly healthService: HealthService) {}

  @Query(() => HealthPayload, {
    description: 'Application and SQLite connectivity check',
  })
  health(): Promise<HealthPayload> {
    return this.healthService.check();
  }
}
