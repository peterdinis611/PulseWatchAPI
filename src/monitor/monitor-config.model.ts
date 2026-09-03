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
}
