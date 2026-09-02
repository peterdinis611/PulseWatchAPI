import {
  Injectable,
  LoggerService as NestLoggerService,
  LogLevel,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const LOG_LEVELS: LogLevel[] = [
  'verbose',
  'debug',
  'log',
  'warn',
  'error',
  'fatal',
];

const DEFAULT_CONTEXT = 'PulseWatch';

export interface LogRecord {
  level: LogLevel;
  message: string;
  context: string;
  timestamp: string;
  stack?: string;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private minLevel: LogLevel;
  private readonly json: boolean;

  constructor(config: ConfigService) {
    const nodeEnv = config.get<string>('NODE_ENV', 'development');
    this.json = nodeEnv === 'production';
    this.minLevel = this.parseLevel(
      config.get<string>('LOG_LEVEL'),
      nodeEnv === 'production' ? 'log' : 'debug',
    );
  }

  log(message: any, ...optionalParams: any[]): void {
    this.write('log', message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: any, ...optionalParams: any[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: any, ...optionalParams: any[]): void {
    this.write('fatal', message, optionalParams);
  }

  setLogLevels(levels: LogLevel[]): void {
    const ranks = levels
      .map((level) => LOG_LEVELS.indexOf(level))
      .filter((rank) => rank >= 0);

    if (ranks.length === 0) {
      return;
    }

    this.minLevel = LOG_LEVELS[Math.min(...ranks)] ?? this.minLevel;
  }

  private write(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    if (!this.isEnabled(level)) {
      return;
    }

    const { context, stack } = this.parseMeta(level, optionalParams);
    const record: LogRecord = {
      level,
      message: this.formatMessage(message),
      context,
      timestamp: new Date().toISOString(),
      ...(stack ? { stack } : {}),
    };

    const line = this.json
      ? `${JSON.stringify(record)}\n`
      : this.formatPretty(record);
    const stream =
      level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
    stream.write(line);
  }

  private isEnabled(level: LogLevel): boolean {
    return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(this.minLevel);
  }

  private parseLevel(value: string | undefined, fallback: LogLevel): LogLevel {
    if (value && (LOG_LEVELS as string[]).includes(value)) {
      return value as LogLevel;
    }

    return fallback;
  }

  private parseMeta(
    level: LogLevel,
    optionalParams: unknown[],
  ): { context: string; stack?: string } {
    const strings = optionalParams.filter(
      (param): param is string => typeof param === 'string',
    );

    if (level === 'error' || level === 'fatal') {
      if (strings.length >= 2) {
        return {
          stack: strings[strings.length - 2],
          context: strings[strings.length - 1],
        };
      }

      if (strings.length === 1) {
        const only = strings[0];
        if (only.includes('\n') || only.includes('    at ')) {
          return { context: DEFAULT_CONTEXT, stack: only };
        }

        return { context: only };
      }

      return { context: DEFAULT_CONTEXT };
    }

    return { context: strings.at(-1) ?? DEFAULT_CONTEXT };
  }

  private formatMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private formatPretty(record: LogRecord): string {
    const head = `[${record.timestamp}] ${record.level.toUpperCase().padEnd(7)} [${record.context}] ${record.message}`;
    return record.stack ? `${head}\n${record.stack}\n` : `${head}\n`;
  }
}
