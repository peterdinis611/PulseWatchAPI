import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidTcpHost } from '../is-valid-tcp-host';

@ValidatorConstraint({ name: 'isTcpHost', async: false })
export class IsTcpHostConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidTcpHost(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a hostname or IP address`;
  }
}
