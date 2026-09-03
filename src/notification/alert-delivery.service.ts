import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../logger/logger.service';
import type { MonitorSettingsView } from '../monitor/monitor-settings.service';
import { NotificationType } from './notification-type';

export type AlertPayload = {
  type: NotificationType;
  title: string;
  body: string;
  monitorId?: string | null;
  stressTestId?: string | null;
  event:
    | 'monitor.down'
    | 'monitor.recover'
    | 'stress.passed'
    | 'stress.failed';
};

@Injectable()
export class AlertDeliveryService {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async deliver(
    settings: MonitorSettingsView,
    payload: AlertPayload,
  ): Promise<void> {
    const tasks: Promise<void>[] = [];

    if (settings.webhookUrl?.trim()) {
      tasks.push(this.postWebhook(settings.webhookUrl.trim(), payload));
    }
    if (settings.slackWebhookUrl?.trim()) {
      tasks.push(this.postSlack(settings.slackWebhookUrl.trim(), payload));
    }
    if (settings.alertEmail?.trim()) {
      tasks.push(this.sendEmail(settings.alertEmail.trim(), payload));
    }

    await Promise.allSettled(tasks);
  }

  private async postWebhook(url: string, payload: AlertPayload): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'pulsewatch',
          ...payload,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        throw new Error(`Webhook HTTP ${response.status}`);
      }
    } catch (error) {
      this.logDeliveryError('webhook', error);
    }
  }

  private async postSlack(url: string, payload: AlertPayload): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${payload.title}\n${payload.body}`,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: payload.title },
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: payload.body },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `*PulseWatch* · \`${payload.event}\``,
                },
              ],
            },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(`Slack HTTP ${response.status}`);
      }
    } catch (error) {
      this.logDeliveryError('slack', error);
    }
  }

  private async sendEmail(to: string, payload: AlertPayload): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.debug(
        'SMTP not configured; skipping alert email',
        AlertDeliveryService.name,
      );
      return;
    }

    try {
      const nodemailer = await import('nodemailer');
      const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
      const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });

      await transport.sendMail({
        from:
          this.config.get<string>('SMTP_FROM') ??
          'pulsewatch@localhost',
        to,
        subject: `[PulseWatch] ${payload.title}`,
        text: `${payload.title}\n\n${payload.body}\n\nUdalosť: ${payload.event}`,
      });
    } catch (error) {
      this.logDeliveryError('email', error);
    }
  }

  private logDeliveryError(channel: string, error: unknown): void {
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(
      `External alert delivery failed (${channel})`,
      stack,
      AlertDeliveryService.name,
    );
  }
}
