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

  @Field(() => String, { nullable: true })
  webhookUrl!: string | null;

  @Field(() => String, { nullable: true })
  slackWebhookUrl!: string | null;

  @Field(() => String, { nullable: true })
  alertEmail!: string | null;

  @Field()
  updatedAt!: Date;
}
