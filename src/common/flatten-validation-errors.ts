import { ValidationError } from 'class-validator';

export function flattenValidationErrors(
  errors: ValidationError[],
  parent?: string,
): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children?.length) {
      messages.push(...flattenValidationErrors(error.children, path));
    }
  }

  return messages;
}
