import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { NotificationType } from '../notification/notification-type';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache.keys';
import { generateK6Script } from './k6-script';
import { K6RunnerService } from './k6-runner.service';
import { serializeSummary } from './k6-summary';
import { StressTestStatus } from './stress-test-status';
import { clipError, k6TimeoutMs } from './stress-test.constants';

@Injectable()
export class StressTestExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: K6RunnerService,
    private readonly notifications: NotificationService,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
  ) {}

  async execute(runId: string): Promise<void> {
    const run = await this.prisma.stressTestRun.findUnique({
      where: { id: runId },
      include: { stressTest: true },
    });

    if (!run || run.status !== StressTestStatus.RUNNING) {
      return;
    }

    const test = run.stressTest;
    const script = generateK6Script({
      url: test.url,
      method: test.method,
      vus: test.vus,
      durationSec: test.durationSec,
      expectedStatus: test.expectedStatus,
      p95Ms: test.p95Ms,
      maxFailRate: test.maxFailRate,
    });

    try {
      const result = await this.runner.run(
        script,
        k6TimeoutMs(test.durationSec),
      );
      const passed = !result.timedOut && result.exitCode === 0;
      const status = passed ? StressTestStatus.PASSED : StressTestStatus.FAILED;
      const error = passed
        ? null
        : clipError(
            result.timedOut
              ? 'k6 timed out'
              : result.stderr ||
                  (result.exitCode === 99
                    ? 'k6 thresholds failed'
                    : `k6 exited with code ${result.exitCode}`),
          );
      const summary = serializeSummary(result.summary);

      await this.finish(run.id, test.id, test.userId, test.name, {
        status,
        error,
        summary,
      });
    } catch (error) {
      const message = clipError(
        error instanceof Error ? error.message : String(error),
      );
      await this.finish(run.id, test.id, test.userId, test.name, {
        status: StressTestStatus.FAILED,
        error: message,
        summary: null,
      });
    }
  }

  private async finish(
    runId: string,
    stressTestId: string,
    userId: string,
    name: string,
    result: {
      status: StressTestStatus;
      error: string | null;
      summary: string | null;
    },
  ): Promise<void> {
    const finishedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.stressTestRun.update({
        where: { id: runId },
        data: {
          status: result.status,
          error: result.error,
          summary: result.summary,
          finishedAt,
        },
      }),
      this.prisma.stressTest.update({
        where: { id: stressTestId },
        data: {
          lastStatus: result.status,
          lastError: result.error,
          lastSummary: result.summary,
          lastRunAt: finishedAt,
        },
      }),
    ]);

    this.cache.invalidatePrefix(CacheKeys.stressTestsPrefix(userId));
    await this.notify(userId, name, result.status, result.error);

    this.logger.debug(
      `Stress test ${name} ${result.status}`,
      StressTestExecutorService.name,
    );
  }

  private async notify(
    userId: string,
    name: string,
    status: StressTestStatus,
    error: string | null,
  ): Promise<void> {
    try {
      if (status === StressTestStatus.PASSED) {
        await this.notifications.createForUser(userId, {
          type: NotificationType.SUCCESS,
          title: `${name} passed`,
          body: `${name} finished within thresholds`,
        });
        return;
      }

      await this.notifications.createForUser(userId, {
        type: NotificationType.ALERT,
        title: `${name} failed`,
        body: error ?? `${name} failed a k6 run`,
      });
    } catch (notifyError) {
      const stack =
        notifyError instanceof Error ? notifyError.stack : undefined;
      this.logger.error(
        `Failed to notify stress test result for ${name}`,
        stack,
        StressTestExecutorService.name,
      );
    }
  }
}
