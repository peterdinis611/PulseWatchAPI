import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import type { PublicUser } from './public-user';
import { User } from './user.model';
import { UserService } from './user.service';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly users: UserService) {}

  @Query(() => User, { description: 'Currently authenticated user' })
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: PublicUser): Promise<PublicUser> {
    return this.users.findPublicById(user.id);
  }
}
