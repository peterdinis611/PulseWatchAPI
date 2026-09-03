import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseK6Summary, type StressTestSummaryValue } from './k6-summary';
import {
  clipError,
  DEFAULT_K6_BIN,
  K6_INSTALL_URL,
} from './stress-test.constants';

export const K6_NOT_INSTALLED = `k6 is not installed. Install it from ${K6_INSTALL_URL}`;

export type K6RunResult = {
  exitCode: number;
  stderr: string;
  summary: StressTestSummaryValue | null;
  timedOut: boolean;
};

@Injectable()
export class K6RunnerService {
  constructor(private readonly config: ConfigService) {}

  async run(script: string, timeoutMs: number): Promise<K6RunResult> {
    const dir = await mkdtemp(join(tmpdir(), 'pulsewatch-k6-'));
    const scriptPath = join(dir, 'script.js');
    const summaryPath = join(dir, 'summary.json');
    const bin = this.config.get<string>('K6_BIN')?.trim() || DEFAULT_K6_BIN;

    try {
      await writeFile(scriptPath, script, 'utf8');
      const { code, stderr, timedOut } = await spawnK6(
        bin,
        ['run', '--quiet', '--summary-export', summaryPath, scriptPath],
        timeoutMs,
      );
      const summary = await readSummary(summaryPath);
      return {
        exitCode: code,
        stderr: clipError(stderr.trim()),
        summary,
        timedOut,
      };
    } catch (error) {
      if (isEnoent(error)) {
        throw new Error(K6_NOT_INSTALLED);
      }
      throw error;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error != null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  );
}

async function readSummary(
  summaryPath: string,
): Promise<StressTestSummaryValue | null> {
  try {
    const raw = await readFile(summaryPath, 'utf8');
    return parseK6Summary(raw);
  } catch {
    return null;
  }
}

function spawnK6(
  bin: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number; stderr: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;

    const finish = (error?: Error, code = 1) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (killTimer) {
        clearTimeout(killTimer);
      }
      if (error) {
        reject(error);
        return;
      }
      resolve({ code, stderr, timedOut });
    };

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
      if (stderr.length > 8_000) {
        stderr = stderr.slice(-8_000);
      }
    });

    child.on('error', (error) => finish(error));
    child.on('close', (code) => finish(undefined, code ?? 1));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 2_000);
    }, timeoutMs);
  });
}
