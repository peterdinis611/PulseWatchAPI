import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../logger.service';

function createConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string, defaultValue?: string) => values[key] ?? defaultValue,
  };
}

function writtenLines(
  spy: jest.SpiedFunction<typeof process.stdout.write>,
): string[] {
  return spy.mock.calls.map((call) => String(call[0] ?? ''));
}

describe('LoggerService', () => {
  let stdout: jest.SpiedFunction<typeof process.stdout.write>;
  let stderr: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdout.mockRestore();
    stderr.mockRestore();
  });

  async function createLogger(
    values: Record<string, string | undefined>,
  ): Promise<LoggerService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        {
          provide: ConfigService,
          useValue: createConfig(values),
        },
      ],
    }).compile();

    return module.get(LoggerService);
  }

  it('writes Nest ConsoleLogger lines to stdout with context', async () => {
    const logger = await createLogger({
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
    });

    logger.log('listening', 'Bootstrap');

    expect(stdout).toHaveBeenCalled();
    const line = writtenLines(stdout)[0] ?? '';
    expect(line).toContain('LOG');
    expect(line).toContain('[Bootstrap]');
    expect(line).toContain('listening');
    expect(stderr).not.toHaveBeenCalled();
  });

  it('writes errors to stderr with stack and context', async () => {
    const logger = await createLogger({
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
    });

    logger.error('failed', 'stack-trace', 'HealthService');

    expect(stderr).toHaveBeenCalled();
    const output = writtenLines(stderr).join('\n');
    expect(output).toContain('ERROR');
    expect(output).toContain('[HealthService]');
    expect(output).toContain('failed');
    expect(output).toContain('stack-trace');
  });

  it('skips debug when LOG_LEVEL is log', async () => {
    const logger = await createLogger({
      NODE_ENV: 'test',
      LOG_LEVEL: 'log',
    });

    logger.debug('hidden');
    logger.log('visible');

    const lines = writtenLines(stdout);
    expect(lines.some((line) => line.includes('hidden'))).toBe(false);
    expect(lines.some((line) => line.includes('visible'))).toBe(true);
  });

  it('emits JSON in production', async () => {
    const logger = await createLogger({
      NODE_ENV: 'production',
      LOG_LEVEL: 'log',
    });

    logger.warn('disk almost full', 'Monitor');

    const record = JSON.parse(writtenLines(stdout)[0] ?? '{}') as {
      level: string;
      message: string;
      context: string;
      timestamp: number;
    };

    expect(record.level).toBe('warn');
    expect(record.message).toBe('disk almost full');
    expect(record.context).toBe('Monitor');
    expect(record.timestamp).toEqual(expect.any(Number));
  });

  it('prints object messages through ConsoleLogger', async () => {
    const logger = await createLogger({
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
    });

    logger.log({ event: 'boot' });

    const line = writtenLines(stdout)[0] ?? '';
    expect(line).toContain('event');
    expect(line).toContain('boot');
  });

  it('respects setLogLevels', async () => {
    const logger = await createLogger({
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
    });

    logger.setLogLevels(['error']);
    logger.log('ignored');
    logger.error('kept');

    expect(stdout).not.toHaveBeenCalled();
    expect(writtenLines(stderr).join('\n')).toContain('kept');
  });

  it('falls back to debug when LOG_LEVEL is invalid', async () => {
    const logger = await createLogger({
      NODE_ENV: 'test',
      LOG_LEVEL: 'nope',
    });

    logger.debug('still visible');

    expect(writtenLines(stdout)[0]).toContain('still visible');
  });
});
