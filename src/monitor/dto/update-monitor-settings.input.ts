import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MAX_INTERVAL_SEC,
  MAX_TIMEOUT_MS,
  MIN_INTERVAL_SEC,
  MIN_TIMEOUT_MS,
} from '../monitor.constants';

@InputType()
export class UpdateMonitorSettingsInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_INTERVAL_SEC)
  @Max(MAX_INTERVAL_SEC)
  defaultIntervalSec?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_TIMEOUT_MS)
  @Max(MAX_TIMEOUT_MS)
  defaultTimeoutMs?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyOnDown?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyOnRecover?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_tld: false }, { message: 'Webhook URL must be valid' })
  webhookUrl?: string | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_tld: false }, { message: 'Slack webhook URL must be valid' })
  slackWebhookUrl?: string | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  @IsEmail({}, { message: 'Alert email must be valid' })
  alertEmail?: string | null;
}
