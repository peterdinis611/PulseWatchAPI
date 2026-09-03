import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
} from 'class-validator';

@InputType()
export class HttpMonitorConfigInput {
  @Field()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  url!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
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
  @IsString()
  @MinLength(8)
  url!: string;
}

@InputType()
export class DatabaseMonitorConfigInput {
  @Field({
    description: 'postgres://, mysql://, or file: SQLite connection URL',
  })
  @IsString()
  @MinLength(3)
  url!: string;
}

@InputType()
export class TcpMonitorConfigInput {
  @Field()
  @IsString()
  @MinLength(1)
  host!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;
}
