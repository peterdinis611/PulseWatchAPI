import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
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
import { HTTP_METHODS, MAX_URL_LENGTH } from '../monitor.constants';
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
