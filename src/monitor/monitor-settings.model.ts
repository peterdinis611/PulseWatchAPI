import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MonitorSettings {
  @Field(() => Int)
  defaultIntervalSec!: number;

  @Field(() => Int)
  defaultTimeoutMs!: number;

  @Field()
  notifyOnDown!: boolean;

  @Field()
  notifyOnRecover!: boolean;

  @Field()
  updatedAt!: Date;
}
