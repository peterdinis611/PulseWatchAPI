import { Field, ObjectType } from '@nestjs/graphql';
import { NotificationType } from './notification-type';

@ObjectType()
export class Notification {
  @Field()
  id!: string;

  @Field(() => NotificationType)
  type!: NotificationType;

  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field(() => Date, { nullable: true })
  readAt!: Date | null;

  @Field()
  createdAt!: Date;
}
