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

  @Field(() => String, { nullable: true })
  monitorId!: string | null;

  @Field(() => String, { nullable: true })
  stressTestId!: string | null;

  @Field(() => Date, { nullable: true })
  readAt!: Date | null;

  @Field()
  createdAt!: Date;
}
