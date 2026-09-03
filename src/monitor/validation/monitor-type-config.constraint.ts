import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { MonitorType } from '../monitor-type';
import {
  MonitorConfigBag,
  validateMonitorTypeConfig,
} from '../validate-monitor-type-config';

@ValidatorConstraint({ name: 'monitorCreateConfig', async: false })
export class MonitorCreateConfigConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const input = args.object as MonitorConfigBag & { type?: MonitorType };
    return validateMonitorTypeConfig(input.type, input, true) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    const input = args.object as MonitorConfigBag & { type?: MonitorType };
    return (
      validateMonitorTypeConfig(input.type, input, true) ??
      'Invalid monitor config'
    );
  }
}

@ValidatorConstraint({ name: 'monitorUpdateConfig', async: false })
export class MonitorUpdateConfigConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const input = args.object as MonitorConfigBag & { type?: MonitorType };
    return validateMonitorTypeConfig(input.type, input, false) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    const input = args.object as MonitorConfigBag & { type?: MonitorType };
    return (
      validateMonitorTypeConfig(input.type, input, false) ??
      'Invalid monitor config'
    );
  }
}
