import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { LoggerService } from '../../logger/logger.service';
import { StressTestExecutorService } from '../stress-test-executor.service';
import { StressTestProcessor } from '../stress-test.processor';
import type { StressTestJobData } from '../../jobs/stress-test.job';

describe('StressTestProcessor', () => {
  let processor: StressTestProcessor;
  let execute: jest.Mock;
  let warn: jest.Mock;

  beforeEach(async () => {
    execute = jest.fn().mockResolvedValue(undefined);
    warn = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StressTestProcessor,
        {
          provide: StressTestExecutorService,
          useValue: { execute },
        },
        {
          provide: LoggerService,
          useValue: { warn },
        },
      ],
    }).compile();

    processor = module.get(StressTestProcessor);
  });

  function job(data: Partial<StressTestJobData> = {}): Job<StressTestJobData> {
    return { id: 'job-1', data } as Job<StressTestJobData>;
  }

  it('executes a run', async () => {
    await processor.process(job({ runId: 'run-1' }));
    expect(execute).toHaveBeenCalledWith('run-1');
  });

  it('skips a job without runId', async () => {
    await processor.process(job({}));
    expect(execute).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});
