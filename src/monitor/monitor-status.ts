import { registerEnumType } from '@nestjs/graphql';

export enum MonitorStatus {
  UNKNOWN = 'UNKNOWN',
  UP = 'UP',
  DOWN = 'DOWN',
}

registerEnumType(MonitorStatus, {
  name: 'MonitorStatus',
  description: 'Latest probe result for a monitor',
});
