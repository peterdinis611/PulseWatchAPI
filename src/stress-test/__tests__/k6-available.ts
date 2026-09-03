import { spawnSync } from 'node:child_process';

export function k6Available(): boolean {
  try {
    const result = spawnSync('k6', ['version'], { encoding: 'utf8' });
    return result.status === 0;
  } catch {
    return false;
  }
}
