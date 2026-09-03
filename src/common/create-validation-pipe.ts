import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { flattenValidationErrors } from './flatten-validation-errors';

export function createAppValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors) => {
      const messages = flattenValidationErrors(errors);
      return new BadRequestException(messages[0] ?? 'Validation failed');
    },
  });
}
