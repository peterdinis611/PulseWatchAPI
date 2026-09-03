import { isIP } from 'node:net';

const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export function isValidTcpHost(value: string): boolean {
  const host = value.trim();
  if (!host || host.length > 253) {
    return false;
  }
  if (host.includes('/') || host.includes(' ')) {
    return false;
  }
  if (isIP(host)) {
    return true;
  }
  if (host.includes(':')) {
    return false;
  }
  if (host.toLowerCase() === 'localhost') {
    return true;
  }
  return HOSTNAME.test(host);
}
