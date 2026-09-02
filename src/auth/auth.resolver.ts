import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthPayload } from './auth.payload.model';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';

@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Mutation(() => AuthPayload, { description: 'Create an account' })
  register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    return this.auth.register(input);
  }

  @Mutation(() => AuthPayload, { description: 'Sign in and receive a JWT' })
  login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.auth.login(input);
  }
}
