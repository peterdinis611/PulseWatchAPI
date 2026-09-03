import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/trim';
import {
  MAX_DURATION_SEC,
  MAX_FAIL_RATE,
  MAX_P95_MS,
  MAX_SCHEDULE_INTERVAL_SEC,
  MAX_STRESS_TEST_NAME_LENGTH,
  MAX_URL_LENGTH,
  MAX_VUS,
  MIN_DURATION_SEC,
  MIN_FAIL_RATE,
  MIN_P95_MS,
  MIN_SCHEDULE_INTERVAL_SEC,
  MIN_VUS,
  STRESS_TEST_METHODS,
} from '../stress-test.constants';

@InputType()
export class UpdateStressTestInput {
  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(MAX_STRESS_TEST_NAME_LENGTH)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsUrl(
    { require_tld: false, protocols: ['http', 'https'] },
    { message: 'HTTP URL must use http or https' },
  )
  @MaxLength(MAX_URL_LENGTH)
  url?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(STRESS_TEST_METHODS, {
    message: 'HTTP method must be GET, HEAD, POST, PUT, PATCH, or DELETE',
  })
  method?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_VUS)
  @Max(MAX_VUS)
  vus?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_DURATION_SEC)
  @Max(MAX_DURATION_SEC)
  durationSec?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  expectedStatus?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_P95_MS)
  @Max(MAX_P95_MS)
  p95Ms?: number | null;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(MIN_FAIL_RATE)
  @Max(MAX_FAIL_RATE)
  maxFailRate?: number | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  scheduleEnabled?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_SCHEDULE_INTERVAL_SEC)
  @Max(MAX_SCHEDULE_INTERVAL_SEC)
  scheduleIntervalSec?: number | null;
}
