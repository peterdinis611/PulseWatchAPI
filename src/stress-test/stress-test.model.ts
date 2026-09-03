import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { StressTestStatus } from './stress-test-status';
import { StressTestSummary } from './stress-test-summary.model';

@ObjectType()
export class StressTest {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  url!: string;

  @Field()
  method!: string;

  @Field(() => Int)
  vus!: number;

  @Field(() => Int)
  durationSec!: number;

  @Field(() => Int)
  expectedStatus!: number;

  @Field(() => Int, { nullable: true })
  p95Ms!: number | null;

  @Field(() => Float, { nullable: true })
  maxFailRate!: number | null;

  @Field(() => StressTestStatus)
  lastStatus!: StressTestStatus;

  @Field(() => String, { nullable: true })
  lastError!: string | null;

  @Field(() => StressTestSummary, { nullable: true })
  lastSummary!: StressTestSummary | null;

  @Field(() => Date, { nullable: true })
  lastRunAt!: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
