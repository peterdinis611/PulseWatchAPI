import { Args, ArgsOptions } from '@nestjs/graphql';
import { ParseUUIDPipe } from '@nestjs/common';

export function UuidArgs(
  property = 'id',
  options?: ArgsOptions,
): ParameterDecorator {
  return Args(
    property,
    { type: () => String, ...options },
    new ParseUUIDPipe({ version: '4' }),
  );
}
