import { notificationReceivedTrigger } from '../notification.events';

describe('notificationReceivedTrigger', () => {
  it('scopes the pub/sub channel to a user', () => {
    expect(notificationReceivedTrigger('user-1')).toBe(
      'notificationReceived.user-1',
    );
  });
});
