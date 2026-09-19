import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class K6Status {
  @Field()
  installed!: boolean;

  @Field(() => String, { nullable: true })
  message!: string | null;
}
