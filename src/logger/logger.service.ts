import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const LOG_LEVELS: LogLevel[] = [
  'verbose',
  'debug',
  'log',
  'warn',
  'error',
  'fatal',
];

function parseLogLevel(
  value: string | undefined,
  fallback: LogLevel,
): LogLevel {
  if (value && (LOG_LEVELS as string[]).includes(value)) {
    return value as LogLevel;
  }

  return fallback;
}

function logLevelsFrom(minLevel: LogLevel): LogLevel[] {
  const index = LOG_LEVELS.indexOf(minLevel);
  return LOG_LEVELS.slice(index >= 0 ? index : LOG_LEVELS.indexOf('log'));
}

@Injectable()
export class LoggerService extends ConsoleLogger {
  constructor(config: ConfigService) {
    const nodeEnv = config.get<string>('NODE_ENV', 'development');
    const isProd = nodeEnv === 'production';
    const minLevel = parseLogLevel(
      config.get<string>('LOG_LEVEL'),
      isProd ? 'log' : 'debug',
    );

    super({
      prefix: 'PulseWatch',
      context: 'PulseWatch',
      json: isProd,
      compact: isProd,
      colors: nodeEnv === 'development',
      logLevels: logLevelsFrom(minLevel),
    });
  }
}
