import { BadRequestException } from '@nestjs/common';
import { assertHttpMethod, assertHttpUrl } from '../assert-http-url';

describe('assertHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(assertHttpUrl(' https://example.com/load ')).toBe(
      'https://example.com/load',
    );
    expect(assertHttpUrl('http://localhost:3000')).toBe(
      'http://localhost:3000',
    );
  });

  it('rejects non-http URLs', () => {
    expect(() => assertHttpUrl('ftp://example.com')).toThrow(
      BadRequestException,
    );
    expect(() => assertHttpUrl('not a url')).toThrow(BadRequestException);
  });
});

describe('assertHttpMethod', () => {
  it('defaults to GET and uppercases', () => {
    expect(assertHttpMethod(undefined)).toBe('GET');
    expect(assertHttpMethod('patch')).toBe('PATCH');
  });

  it('rejects unsupported methods', () => {
    expect(() => assertHttpMethod('TRACE')).toThrow(BadRequestException);
  });
});
