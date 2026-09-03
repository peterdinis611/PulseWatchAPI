import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class StressTestSummary {
  @Field(() => Int, { nullable: true })
  httpReqs!: number | null;

  @Field(() => Float, { nullable: true })
  failRate!: number | null;

  @Field(() => Float, { nullable: true })
  p95Ms!: number | null;

  @Field(() => Float, { nullable: true })
  avgMs!: number | null;

  @Field(() => Int, { nullable: true })
  checksPassed!: number | null;

  @Field(() => Int, { nullable: true })
  checksFailed!: number | null;
}
