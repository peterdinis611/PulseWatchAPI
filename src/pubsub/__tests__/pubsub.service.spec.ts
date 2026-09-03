import { PubSubService } from '../pubsub.service';

describe('PubSubService', () => {
  it('delivers published payloads to subscribers', async () => {
    const pubSub = new PubSubService();
    const iterator = pubSub.asyncIterator<{ ping: string }>('ping');
    const next = iterator.next();

    await pubSub.publish('ping', { ping: 'pong' });

    await expect(next).resolves.toEqual({
      value: { ping: 'pong' },
      done: false,
    });

    await iterator.return?.(undefined);
  });
});
