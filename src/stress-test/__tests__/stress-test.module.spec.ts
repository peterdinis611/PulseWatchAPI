import { MODULE_METADATA } from '@nestjs/common/constants';
import { K6RunnerService } from '../k6-runner.service';
import { StressTestExecutorService } from '../stress-test-executor.service';
import { StressTestModule } from '../stress-test.module';
import { StressTestResolver } from '../stress-test.resolver';
import { StressTestService } from '../stress-test.service';

describe('StressTestModule', () => {
  it('provides stress test services and resolver', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      StressTestModule,
    ) as unknown[];

    expect(providers).toEqual(
      expect.arrayContaining([
        StressTestService,
        StressTestResolver,
        K6RunnerService,
        StressTestExecutorService,
      ]),
    );
  });

  it('exports StressTestService', () => {
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      StressTestModule,
    ) as unknown[];

    expect(exports).toEqual(expect.arrayContaining([StressTestService]));
  });
});
