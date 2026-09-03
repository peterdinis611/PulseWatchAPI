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
import { MonitorType, MONITOR_TYPE_ENUM_MESSAGE } from '../monitor-type';
import { MonitorUpdateConfigConstraint } from '../validation/monitor-type-config.constraint';
import {
  DatabaseMonitorConfigInput,
  DnsMonitorConfigInput,
  GrpcMonitorConfigInput,
  HttpMonitorConfigInput,
  KafkaMonitorConfigInput,
  RedisMonitorConfigInput,
  SmtpMonitorConfigInput,
  SslMonitorConfigInput,
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
    message: MONITOR_TYPE_ENUM_MESSAGE,
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

  @Field(() => SslMonitorConfigInput, { nullable: true })
  @IsOptional()
  @Validate(MonitorUpdateConfigConstraint)
  @ValidateNested()
  @Type(() => SslMonitorConfigInput)
  ssl?: SslMonitorConfigInput;

  @Field(() => DnsMonitorConfigInput, { nullable: true })
  @IsOptional()
  @Validate(MonitorUpdateConfigConstraint)
  @ValidateNested()
  @Type(() => DnsMonitorConfigInput)
  dns?: DnsMonitorConfigInput;

  @Field(() => SmtpMonitorConfigInput, { nullable: true })
  @IsOptional()
  @Validate(MonitorUpdateConfigConstraint)
  @ValidateNested()
  @Type(() => SmtpMonitorConfigInput)
  smtp?: SmtpMonitorConfigInput;

  @Field(() => KafkaMonitorConfigInput, { nullable: true })
  @IsOptional()
  @Validate(MonitorUpdateConfigConstraint)
  @ValidateNested()
  @Type(() => KafkaMonitorConfigInput)
  kafka?: KafkaMonitorConfigInput;

  @Field(() => GrpcMonitorConfigInput, { nullable: true })
  @IsOptional()
  @Validate(MonitorUpdateConfigConstraint)
  @ValidateNested()
  @Type(() => GrpcMonitorConfigInput)
  grpc?: GrpcMonitorConfigInput;
}
