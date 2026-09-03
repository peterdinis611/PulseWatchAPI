import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { areJobsEnabled } from '../jobs/are-jobs-enabled';
import { NotificationModule } from '../notification/notification.module';
import { MonitorCheckProcessor } from './monitor-check.processor';
import { MonitorJobsSyncService } from './monitor-jobs-sync.service';
import { MonitorProbeService } from './monitor-probe.service';
import { MonitorResolver } from './monitor.resolver';
import { MonitorRunnerService } from './monitor-runner.service';
import { MonitorSchedulerService } from './monitor-scheduler.service';
import { MonitorService } from './monitor.service';

const jobProviders = areJobsEnabled()
  ? [MonitorCheckProcessor, MonitorJobsSyncService]
  : [];

@Module({
  imports: [ScheduleModule.forRoot(), NotificationModule],
  providers: [
    MonitorService,
    MonitorResolver,
    MonitorProbeService,
    MonitorRunnerService,
    MonitorSchedulerService,
    ...jobProviders,
  ],
  exports: [MonitorService],
})
export class MonitorModule {}
