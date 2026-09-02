import { MODULE_METADATA } from '@nestjs/common/constants';
import { AuthModule } from '../auth.module';
import { AuthResolver } from '../auth.resolver';
import { AuthService } from '../auth.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { JwtStrategy } from '../strategies/jwt.strategy';

describe('AuthModule', () => {
  it('provides auth services and JWT strategy', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AuthModule,
    ) as unknown[];

    expect(providers).toEqual(
      expect.arrayContaining([
        AuthService,
        AuthResolver,
        JwtStrategy,
        GqlAuthGuard,
      ]),
    );
  });

  it('exports AuthService and GqlAuthGuard', () => {
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      AuthModule,
    ) as unknown[];

    expect(exports).toEqual(
      expect.arrayContaining([AuthService, GqlAuthGuard]),
    );
  });
});
