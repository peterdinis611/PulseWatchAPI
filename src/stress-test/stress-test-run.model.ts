import { Field, ObjectType } from '@nestjs/graphql';
import { StressTestStatus } from './stress-test-status';
import { StressTestSummary } from './stress-test-summary.model';

@ObjectType()
export class StressTestRun {
  @Field()
  id!: string;

  @Field()
  stressTestId!: string;

  @Field(() => StressTestStatus)
  status!: StressTestStatus;

  @Field(() => String, { nullable: true })
  error!: string | null;

  @Field(() => StressTestSummary, { nullable: true })
  summary!: StressTestSummary | null;

  @Field()
  startedAt!: Date;

  @Field(() => Date, { nullable: true })
  finishedAt!: Date | null;
}
