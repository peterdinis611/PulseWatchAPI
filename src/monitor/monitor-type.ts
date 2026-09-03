import { registerEnumType } from '@nestjs/graphql';

export enum MonitorType {
  HTTP = 'HTTP',
  REDIS = 'REDIS',
  DATABASE = 'DATABASE',
  TCP = 'TCP',
  SSL = 'SSL',
  DNS = 'DNS',
  SMTP = 'SMTP',
  KAFKA = 'KAFKA',
  GRPC = 'GRPC',
}

registerEnumType(MonitorType, {
  name: 'MonitorType',
  description: 'What PulseWatch should probe',
});

export const MONITOR_TYPE_ENUM_MESSAGE =
  'type must be HTTP, REDIS, DATABASE, TCP, SSL, DNS, SMTP, KAFKA, or GRPC';
