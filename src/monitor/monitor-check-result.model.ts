import { Field, Int, ObjectType } from '@nestjs/graphql';
import { MonitorStatus } from './monitor-status';

@ObjectType()
export class MonitorCheckResult {
  @Field(() => MonitorStatus)
  status!: MonitorStatus;

  @Field(() => String, { nullable: true })
  error!: string | null;

  @Field(() => Int)
  latencyMs!: number;

  @Field()
  checkedAt!: Date;
}

export type MonitorCheckResultView = {
  status: MonitorStatus;
  error: string | null;
  latencyMs: number;
  checkedAt: Date;
};
