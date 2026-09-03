import { Injectable } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

@Injectable()
export class PubSubService {
  private readonly engine = new PubSub();

  publish(trigger: string, payload: Record<string, unknown>): Promise<void> {
    return this.engine.publish(trigger, payload);
  }

  asyncIterator<T>(trigger: string | readonly string[]): AsyncIterableIterator<T> {
    return this.engine.asyncIterableIterator<T>(trigger);
  }
}
