import { k6TimeoutMs } from '../stress-test.constants';

describe('k6TimeoutMs', () => {
  it('adds a 15s grace period', () => {
    expect(k6TimeoutMs(30)).toBe(45_000);
  });
});
