import { EventEmitter } from 'node:events';
import { ConfigService } from '@nestjs/config';
import { K6_NOT_INSTALLED, K6RunnerService } from '../k6-runner.service';

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  mkdtemp: jest.fn().mockResolvedValue('/tmp/pulsewatch-k6-test'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(new Error('missing summary')),
  rm: jest.fn().mockResolvedValue(undefined),
}));

import { spawn } from 'node:child_process';

describe('K6RunnerService', () => {
  const spawnMock = spawn as unknown as jest.Mock;

  function fakeChild() {
    const child = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
      kill: jest.Mock;
    };
    child.stderr = new EventEmitter();
    child.kill = jest.fn();
    return child;
  }

  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('maps ENOENT to a k6 install error', async () => {
    spawnMock.mockImplementation(() => {
      const child = fakeChild();
      process.nextTick(() => {
        child.emit(
          'error',
          Object.assign(new Error('spawn k6 ENOENT'), { code: 'ENOENT' }),
        );
      });
      return child;
    });
    const runner = new K6RunnerService({
      get: () => 'k6',
    } as unknown as ConfigService);

    await expect(
      runner.run('export default function () {}', 1_000),
    ).rejects.toThrow(K6_NOT_INSTALLED);
  });

  it('returns the k6 exit code', async () => {
    spawnMock.mockImplementation(() => {
      const child = fakeChild();
      process.nextTick(() => child.emit('close', 99));
      return child;
    });
    const runner = new K6RunnerService({
      get: () => undefined,
    } as unknown as ConfigService);

    await expect(
      runner.run('export default function () {}', 5_000),
    ).resolves.toEqual({
      exitCode: 99,
      stderr: '',
      summary: null,
      timedOut: false,
    });
  });
});
