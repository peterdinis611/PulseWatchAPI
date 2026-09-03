import { BadRequestException } from '@nestjs/common';
import {
  STRESS_TEST_METHODS,
  type StressTestMethod,
} from './stress-test.constants';

export function assertHttpUrl(value: string): string {
  const raw = value.trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Invalid HTTP URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Stress tests require an http or https URL');
  }
  if (!url.hostname) {
    throw new BadRequestException('HTTP URL must include a hostname');
  }

  return raw;
}

export function assertHttpMethod(value: string | undefined): StressTestMethod {
  const method = (value ?? 'GET').trim().toUpperCase();
  if (!STRESS_TEST_METHODS.includes(method as StressTestMethod)) {
    throw new BadRequestException(
      'HTTP method must be GET, HEAD, POST, PUT, PATCH, or DELETE',
    );
  }

  return method as StressTestMethod;
}
