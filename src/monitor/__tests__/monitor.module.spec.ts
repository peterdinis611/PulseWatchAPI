import { MODULE_METADATA } from '@nestjs/common/constants';
import { MonitorModule } from '../monitor.module';
import { MonitorProbeService } from '../monitor-probe.service';
import { MonitorResolver } from '../monitor.resolver';
import { MonitorRunnerService } from '../monitor-runner.service';
import { MonitorSchedulerService } from '../monitor-scheduler.service';
import { MonitorService } from '../monitor.service';

describe('MonitorModule', () => {
  it('provides monitor services and resolver', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      MonitorModule,
    ) as unknown[];

    expect(providers).toEqual(
      expect.arrayContaining([
        MonitorService,
        MonitorResolver,
        MonitorProbeService,
        MonitorRunnerService,
        MonitorSchedulerService,
      ]),
    );
  });

  it('exports MonitorService', () => {
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      MonitorModule,
    ) as unknown[];

    expect(exports).toEqual(expect.arrayContaining([MonitorService]));
  });
});
