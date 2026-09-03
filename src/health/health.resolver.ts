import { Query, Resolver, Subscription } from '@nestjs/graphql';
import { HEALTH_UPDATED } from '../pubsub/pubsub.events';
import { PubSubService } from '../pubsub/pubsub.service';
import { HealthPayload } from './health.model';
import { HealthService } from './health.service';

@Resolver()
export class HealthResolver {
  constructor(
    private readonly healthService: HealthService,
    private readonly pubSub: PubSubService,
  ) {}

  @Query(() => HealthPayload, {
    description: 'Application and SQLite connectivity check',
  })
  async health(): Promise<HealthPayload> {
    const payload = await this.healthService.check();
    await this.pubSub.publish(HEALTH_UPDATED, { healthUpdated: payload });
    return payload;
  }

  @Subscription(() => HealthPayload, {
    description: 'Emits whenever a health check runs',
  })
  healthUpdated(): AsyncIterableIterator<{ healthUpdated: HealthPayload }> {
    return this.pubSub.asyncIterator(HEALTH_UPDATED);
  }
}
