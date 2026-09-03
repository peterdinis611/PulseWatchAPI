import { Field, Int, ObjectType } from '@nestjs/graphql';
import { MonitorConfig } from './monitor-config.model';
import { MonitorStatus } from './monitor-status';
import { MonitorType } from './monitor-type';

@ObjectType()
export class Monitor {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field(() => MonitorType)
  type!: MonitorType;

  @Field()
  enabled!: boolean;

  @Field(() => Int)
  intervalSec!: number;

  @Field(() => Int)
  timeoutMs!: number;

  @Field(() => MonitorConfig)
  config!: MonitorConfig;

  @Field(() => MonitorStatus)
  lastStatus!: MonitorStatus;

  @Field(() => String, { nullable: true })
  lastError!: string | null;

  @Field(() => Int, { nullable: true })
  lastLatencyMs!: number | null;

  @Field(() => Date, { nullable: true })
  lastCheckedAt!: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
