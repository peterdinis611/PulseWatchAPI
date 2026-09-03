import { Field, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../common/trim';
import {
  MAX_INTERVAL_SEC,
  MAX_MONITOR_NAME_LENGTH,
  MAX_TIMEOUT_MS,
  MIN_INTERVAL_SEC,
  MIN_TIMEOUT_MS,
} from '../monitor.constants';
import { MonitorType } from '../monitor-type';
import { MonitorUpdateConfigConstraint } from '../validation/monitor-type-config.constraint';
import {
  DatabaseMonitorConfigInput,
  HttpMonitorConfigInput,
  RedisMonitorConfigInput,
  TcpMonitorConfigInput,
} from './monitor-config.input';

@InputType()
export class UpdateMonitorInput {
  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(MAX_MONITOR_NAME_LENGTH)
  name?: string;

  @Field(() => MonitorType, { nullable: true })
  @IsOptional()
  @IsEnum(MonitorType, {
    message: 'type must be HTTP, REDIS, DATABASE, or TCP',
  })
  type?: MonitorType;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_INTERVAL_SEC)
  @Max(MAX_INTERVAL_SEC)
  intervalSec?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_TIMEOUT_MS)
  @Max(MAX_TIMEOUT_MS)
  timeoutMs?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Field(() => HttpMonitorConfigInput, { nullable: true })
  @IsOptional()
  @Validate(MonitorUpdateConfigConstraint)
  @ValidateNested()
  @Type(() => HttpMonitorConfigInput)
  http?: HttpMonitorConfigInput;

  @Field(() => RedisMonitorConfigInput, { nullable: true })
  @IsOptional()
  @Validate(MonitorUpdateConfigConstraint)
  @ValidateNested()
  @Type(() => RedisMonitorConfigInput)
  redis?: RedisMonitorConfigInput;

  @Field(() => DatabaseMonitorConfigInput, { nullable: true })
  @IsOptional()
  @Validate(MonitorUpdateConfigConstraint)
  @ValidateNested()
  @Type(() => DatabaseMonitorConfigInput)
  database?: DatabaseMonitorConfigInput;

  @Field(() => TcpMonitorConfigInput, { nullable: true })
  @IsOptional()
  @Validate(MonitorUpdateConfigConstraint)
  @ValidateNested()
  @Type(() => TcpMonitorConfigInput)
  tcp?: TcpMonitorConfigInput;
}
