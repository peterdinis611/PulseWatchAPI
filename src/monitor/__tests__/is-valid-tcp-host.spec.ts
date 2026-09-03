import { isValidTcpHost } from '../is-valid-tcp-host';

describe('isValidTcpHost', () => {
  it('accepts hostnames, localhost and IPs', () => {
    expect(isValidTcpHost('example.com')).toBe(true);
    expect(isValidTcpHost('localhost')).toBe(true);
    expect(isValidTcpHost('127.0.0.1')).toBe(true);
    expect(isValidTcpHost('::1')).toBe(true);
  });

  it('rejects empty values, paths and host:port', () => {
    expect(isValidTcpHost('')).toBe(false);
    expect(isValidTcpHost('example.com:80')).toBe(false);
    expect(isValidTcpHost('example.com/health')).toBe(false);
    expect(isValidTcpHost('bad host')).toBe(false);
  });
});
