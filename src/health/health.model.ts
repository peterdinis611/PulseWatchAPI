import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class HealthPayload {
  @Field()
  status!: string;

  @Field()
  database!: string;

  @Field()
  timestamp!: string;
}
