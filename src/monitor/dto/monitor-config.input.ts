import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
} from 'class-validator';
import { Trim } from '../../common/trim';
import {
  HTTP_METHODS,
  MAX_CERT_EXPIRY_DAYS,
  MAX_EXPECTED_VALUE_LENGTH,
  MAX_GRPC_SERVICE_LENGTH,
  MAX_KAFKA_TOPIC_LENGTH,
  MAX_URL_LENGTH,
} from '../monitor.constants';
import { DNS_RECORD_TYPES, DnsRecordType } from '../dns-record-type';
import { IsTcpHostConstraint } from '../validation/is-tcp-host.constraint';

@InputType()
export class HttpMonitorConfigInput {
  @Field()
  @Trim()
  @IsUrl(
    { require_tld: false, protocols: ['http', 'https'] },
    { message: 'HTTP URL must use http or https' },
  )
  @MaxLength(MAX_URL_LENGTH)
  url!: string;

  @Field({ nullable: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(HTTP_METHODS, {
    message: 'HTTP method must be GET, HEAD, POST, or PUT',
  })
  method?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  expectedStatus?: number;
}

@InputType()
export class RedisMonitorConfigInput {
  @Field({ description: 'redis:// or rediss:// connection URL' })
  @Trim()
  @IsString()
  @MaxLength(MAX_URL_LENGTH)
  @Matches(/^rediss?:\/\//i, {
    message: 'Redis URL must start with redis:// or rediss://',
  })
  url!: string;
}

@InputType()
export class DatabaseMonitorConfigInput {
  @Field({
    description: 'postgres://, mysql://, or file: SQLite connection URL',
  })
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(MAX_URL_LENGTH)
  @Matches(/^(postgres(ql)?|mysql2?|file|sqlite):/i, {
    message: 'Database URL must start with postgres://, mysql://, or file:',
  })
  url!: string;
}

@InputType()
export class TcpMonitorConfigInput {
  @Field()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @Validate(IsTcpHostConstraint)
  host!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;
}

@InputType()
export class SslMonitorConfigInput {
  @Field()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @Validate(IsTcpHostConstraint)
  host!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @Field({
    nullable: true,
    description: 'SNI hostname when it differs from host',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @Validate(IsTcpHostConstraint)
  serverName?: string;

  @Field(() => Int, {
    nullable: true,
    description:
      'Fail when the certificate expires in fewer than this many days',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CERT_EXPIRY_DAYS)
  minDaysUntilExpiry?: number;

  @Field({
    nullable: true,
    description: 'Skip certificate verification (self-signed lab certs)',
  })
  @IsOptional()
  @IsBoolean()
  allowUnauthorized?: boolean;
}

@InputType()
export class DnsMonitorConfigInput {
  @Field({ description: 'Hostname to resolve' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @Validate(IsTcpHostConstraint)
  host!: string;

  @Field(() => DnsRecordType, { nullable: true })
  @IsOptional()
  @IsIn(DNS_RECORD_TYPES, {
    message: 'recordType must be A, AAAA, CNAME, MX, TXT, or NS',
  })
  recordType?: string;

  @Field({
    nullable: true,
    description: 'Require this value to appear in the response',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_EXPECTED_VALUE_LENGTH)
  expectedValue?: string;

  @Field({
    nullable: true,
    description: 'Optional DNS server IP (IPv4 or IPv6)',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  nameserver?: string;
}

@InputType()
export class SmtpMonitorConfigInput {
  @Field()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @Validate(IsTcpHostConstraint)
  host!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @Field({
    nullable: true,
    description: 'Use implicit TLS (typically port 465)',
  })
  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @Field({
    nullable: true,
    description: 'Upgrade with STARTTLS after EHLO (typically port 587)',
  })
  @IsOptional()
  @IsBoolean()
  startTls?: boolean;

  @Field({
    nullable: true,
    description: 'Skip TLS certificate verification',
  })
  @IsOptional()
  @IsBoolean()
  allowUnauthorized?: boolean;
}

@InputType()
export class KafkaMonitorConfigInput {
  @Field()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @Validate(IsTcpHostConstraint)
  host!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @Field({ nullable: true, description: 'Connect with TLS' })
  @IsOptional()
  @IsBoolean()
  tls?: boolean;

  @Field({
    nullable: true,
    description: 'Fail when this topic is missing',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_KAFKA_TOPIC_LENGTH)
  @Matches(/^[a-z0-9._-]+$/i, {
    message:
      'Kafka topic may only contain letters, numbers, dots, underscores and hyphens',
  })
  topic?: string;
}

@InputType()
export class GrpcMonitorConfigInput {
  @Field()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @Validate(IsTcpHostConstraint)
  host!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @Field({
    nullable: true,
    description: 'Use TLS credentials (insecure plaintext by default)',
  })
  @IsOptional()
  @IsBoolean()
  tls?: boolean;

  @Field({
    nullable: true,
    description: 'grpc.health.v1 service name; empty checks the whole server',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_GRPC_SERVICE_LENGTH)
  service?: string;

  @Field({
    nullable: true,
    description: 'Skip TLS certificate verification',
  })
  @IsOptional()
  @IsBoolean()
  allowUnauthorized?: boolean;
}
