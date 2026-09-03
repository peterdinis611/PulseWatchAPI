import { MonitorType } from './monitor-type';

export const MONITOR_CONFIG_FIELDS = [
  'http',
  'redis',
  'database',
  'tcp',
  'ssl',
  'dns',
  'smtp',
  'kafka',
  'grpc',
] as const;

export type MonitorConfigField = (typeof MONITOR_CONFIG_FIELDS)[number];

export type MonitorConfigBag = Partial<Record<MonitorConfigField, unknown>>;

export function configFieldForType(type: MonitorType): MonitorConfigField {
  switch (type) {
    case MonitorType.HTTP:
      return 'http';
    case MonitorType.REDIS:
      return 'redis';
    case MonitorType.DATABASE:
      return 'database';
    case MonitorType.TCP:
      return 'tcp';
    case MonitorType.SSL:
      return 'ssl';
    case MonitorType.DNS:
      return 'dns';
    case MonitorType.SMTP:
      return 'smtp';
    case MonitorType.KAFKA:
      return 'kafka';
    case MonitorType.GRPC:
      return 'grpc';
    default:
      return 'http';
  }
}

export function presentConfigFields(
  input: MonitorConfigBag,
): MonitorConfigField[] {
  return MONITOR_CONFIG_FIELDS.filter((field) => input[field] != null);
}

export function validateMonitorTypeConfig(
  type: MonitorType | undefined,
  input: MonitorConfigBag,
  required: boolean,
): string | null {
  const present = presentConfigFields(input);

  if (!type) {
    if (present.length > 1) {
      return configChoiceMessage();
    }
    return null;
  }

  const expected = configFieldForType(type);
  const extras = present.filter((field) => field !== expected);

  if (extras.length > 0) {
    return `${type} monitors cannot include ${extras.join(', ')} config`;
  }

  if (required && !present.includes(expected)) {
    return `${expected} config is required for ${type} monitors`;
  }

  return null;
}

function configChoiceMessage(): string {
  const fields = [...MONITOR_CONFIG_FIELDS];
  const last = fields.pop();
  return `Only one of ${fields.join(', ')}, or ${last} config can be set`;
}
