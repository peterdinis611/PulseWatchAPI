import { registerEnumType } from '@nestjs/graphql';

export enum MonitorType {
  HTTP = 'HTTP',
  REDIS = 'REDIS',
  DATABASE = 'DATABASE',
  TCP = 'TCP',
}

registerEnumType(MonitorType, {
  name: 'MonitorType',
  description: 'What PulseWatch should probe',
});
