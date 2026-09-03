import { registerEnumType } from '@nestjs/graphql';

export enum NotificationType {
  INFO = 'INFO',
  ALERT = 'ALERT',
  WARNING = 'WARNING',
  SUCCESS = 'SUCCESS',
}

registerEnumType(NotificationType, {
  name: 'NotificationType',
  description: 'Severity of an in-app notification',
});
