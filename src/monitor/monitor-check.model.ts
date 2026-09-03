import { Field, Int, ObjectType } from '@nestjs/graphql';
import { MonitorStatus } from './monitor-status';

@ObjectType()
export class MonitorCheck {
  @Field()
  id!: string;

  @Field()
  monitorId!: string;

  @Field(() => MonitorStatus)
  status!: MonitorStatus;

  @Field(() => String, { nullable: true })
  error!: string | null;

  @Field(() => Int)
  latencyMs!: number;

  @Field()
  checkedAt!: Date;
}

@ObjectType()
export class MonitorUptime {
  @Field(() => Int)
  periodHours!: number;

  @Field(() => Int)
  totalChecks!: number;

  @Field(() => Int)
  upChecks!: number;

  @Field()
  uptimePercent!: number;

  @Field(() => Int, { nullable: true })
  avgLatencyMs!: number | null;
}
