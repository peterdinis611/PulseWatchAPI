import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { areJobsEnabled } from './are-jobs-enabled';
import { DEFAULT_REDIS_URL, JOBS_REDIS_PREFIX } from './jobs.constants';
import { JobsService, MONITOR_CHECK_QUEUE_TOKEN } from './jobs.service';
import { MONITOR_CHECK_QUEUE } from './monitor-check.job';
import { redisConnectionFromUrl } from './parse-redis-url';

const jobsEnabled = areJobsEnabled();

const bullImports = jobsEnabled
  ? [
      BullModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          prefix: JOBS_REDIS_PREFIX,
          connection: redisConnectionFromUrl(
            config.get<string>('REDIS_URL') ?? DEFAULT_REDIS_URL,
          ),
          defaultJobOptions: {
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 50 },
            attempts: 1,
          },
        }),
      }),
      BullModule.registerQueue({ name: MONITOR_CHECK_QUEUE }),
    ]
  : [];

const queueProvider = jobsEnabled
  ? {
      provide: MONITOR_CHECK_QUEUE_TOKEN,
      useFactory: (queue: Queue) => queue,
      inject: [getQueueToken(MONITOR_CHECK_QUEUE)],
    }
  : {
      provide: MONITOR_CHECK_QUEUE_TOKEN,
      useValue: null,
    };

@Global()
@Module({
  imports: bullImports,
  providers: [JobsService, queueProvider],
  exports: [JobsService],
})
export class JobsModule {}
