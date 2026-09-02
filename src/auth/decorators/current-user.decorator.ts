import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import type { PublicUser } from '../../user/public-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicUser => {
    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext<{ req: Request }>().req;
    return request.user as PublicUser;
  },
);
