import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { createAppValidationPipe } from './common/create-validation-pipe';
import { LoggerService } from './logger/logger.service';

async function bootstrap() {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 4000);

  app.enableCors();
  app.useGlobalPipes(createAppValidationPipe());

  await app.listen(port);
  logger.log(`Listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
