import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../logger.service';

function createConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string, defaultValue?: string) => values[key] ?? defaultValue,
  };
}

describe('LoggerService', () => {
  let stdout: jest.SpyInstance;
  let stderr: jest.SpyInstance;

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

  it('writes pretty log lines to stdout with context', async () => {
    const logger = await createLogger({
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
    });

    logger.log('listening', 'Bootstrap');

    expect(stdout).toHaveBeenCalled();
    const line = String(stdout.mock.calls[0][0]);
    expect(line).toContain('LOG');
    expect(line).toContain('[Bootstrap]');
    expect(line).toContain('listening');
    expect(stderr).not.toHaveBeenCalled();
  });

  it('writes errors to stderr with stack and context', async () => {
    const logger = await createLogger({
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
    });

    logger.error('failed', 'stack-trace', 'HealthService');

    expect(stderr).toHaveBeenCalled();
    const line = String(stderr.mock.calls[0][0]);
    expect(line).toContain('ERROR');
    expect(line).toContain('[HealthService]');
    expect(line).toContain('failed');
    expect(line).toContain('stack-trace');
  });

  it('skips debug when LOG_LEVEL is log', async () => {
    const logger = await createLogger({
      NODE_ENV: 'development',
      LOG_LEVEL: 'log',
    });

    logger.debug('hidden');
    logger.log('visible');

    const lines = stdout.mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => line.includes('hidden'))).toBe(false);
    expect(lines.some((line) => line.includes('visible'))).toBe(true);
  });

  it('emits JSON in production', async () => {
    const logger = await createLogger({
      NODE_ENV: 'production',
      LOG_LEVEL: 'log',
    });

    logger.warn('disk almost full', 'Monitor');

    const record = JSON.parse(String(stdout.mock.calls[0][0])) as {
      level: string;
      message: string;
      context: string;
      timestamp: string;
    };

    expect(record.level).toBe('warn');
    expect(record.message).toBe('disk almost full');
    expect(record.context).toBe('Monitor');
    expect(record.timestamp).toEqual(expect.any(String));
  });

  it('stringifies object messages', async () => {
    const logger = await createLogger({
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
    });

    logger.log({ event: 'boot' });

    expect(String(stdout.mock.calls[0][0])).toContain('{"event":"boot"}');
  });

  it('respects setLogLevels', async () => {
    const logger = await createLogger({
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
    });

    logger.setLogLevels(['error']);
    logger.log('ignored');
    logger.error('kept');

    expect(stdout).not.toHaveBeenCalled();
    expect(String(stderr.mock.calls[0][0])).toContain('kept');
  });

  it('falls back to debug when LOG_LEVEL is invalid', async () => {
    const logger = await createLogger({
      NODE_ENV: 'development',
      LOG_LEVEL: 'nope',
    });

    logger.debug('still visible');

    expect(String(stdout.mock.calls[0][0])).toContain('still visible');
  });
});
