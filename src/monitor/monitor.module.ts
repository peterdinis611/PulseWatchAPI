import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationModule } from '../notification/notification.module';
import { MonitorProbeService } from './monitor-probe.service';
import { MonitorResolver } from './monitor.resolver';
import { MonitorRunnerService } from './monitor-runner.service';
import { MonitorSchedulerService } from './monitor-scheduler.service';
import { MonitorService } from './monitor.service';

@Module({
  imports: [ScheduleModule.forRoot(), NotificationModule],
  providers: [
    MonitorService,
    MonitorResolver,
    MonitorProbeService,
    MonitorRunnerService,
    MonitorSchedulerService,
  ],
  exports: [MonitorService],
})
export class MonitorModule {}
