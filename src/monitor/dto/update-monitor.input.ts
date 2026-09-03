import { Field, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  MAX_INTERVAL_SEC,
  MAX_TIMEOUT_MS,
  MIN_INTERVAL_SEC,
  MIN_TIMEOUT_MS,
} from '../monitor.constants';
import { MonitorType } from '../monitor-type';
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
  @IsString()
  @MinLength(1)
  name?: string;

  @Field(() => MonitorType, { nullable: true })
  @IsOptional()
  @IsEnum(MonitorType)
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
  @ValidateNested()
  @Type(() => HttpMonitorConfigInput)
  http?: HttpMonitorConfigInput;

  @Field(() => RedisMonitorConfigInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RedisMonitorConfigInput)
  redis?: RedisMonitorConfigInput;

  @Field(() => DatabaseMonitorConfigInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DatabaseMonitorConfigInput)
  database?: DatabaseMonitorConfigInput;

  @Field(() => TcpMonitorConfigInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TcpMonitorConfigInput)
  tcp?: TcpMonitorConfigInput;
}
