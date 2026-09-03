import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MonitorConfig {
  @Field({ nullable: true })
  url?: string;

  @Field({ nullable: true })
  method?: string;

  @Field(() => Int, { nullable: true })
  expectedStatus?: number;

  @Field({ nullable: true })
  host?: string;

  @Field(() => Int, { nullable: true })
  port?: number;

  @Field({ nullable: true })
  serverName?: string;

  @Field(() => Int, { nullable: true })
  minDaysUntilExpiry?: number;

  @Field({ nullable: true })
  allowUnauthorized?: boolean;

  @Field({ nullable: true })
  recordType?: string;

  @Field({ nullable: true })
  expectedValue?: string;

  @Field({ nullable: true })
  nameserver?: string;

  @Field({ nullable: true })
  secure?: boolean;

  @Field({ nullable: true })
  startTls?: boolean;

  @Field({ nullable: true })
  tls?: boolean;

  @Field({ nullable: true })
  topic?: string;

  @Field({ nullable: true })
  service?: string;
}
