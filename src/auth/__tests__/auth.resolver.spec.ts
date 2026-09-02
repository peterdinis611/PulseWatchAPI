import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from '../auth.resolver';
import { AuthService } from '../auth.service';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let register: jest.Mock;
  let login: jest.Mock;

  const payload = {
    accessToken: 'jwt-token',
    user: {
      id: 'user-1',
      email: 'ada@pulsewatch.dev',
      name: 'Ada',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  };

  beforeEach(async () => {
    register = jest.fn().mockResolvedValue(payload);
    login = jest.fn().mockResolvedValue(payload);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        {
          provide: AuthService,
          useValue: { register, login },
        },
      ],
    }).compile();

    resolver = module.get(AuthResolver);
  });

  it('registers through AuthService', async () => {
    const input = {
      email: 'ada@pulsewatch.dev',
      password: 'password1',
      name: 'Ada',
    };

    await expect(resolver.register(input)).resolves.toEqual(payload);
    expect(register).toHaveBeenCalledWith(input);
  });

  it('logs in through AuthService', async () => {
    const input = { email: 'ada@pulsewatch.dev', password: 'password1' };

    await expect(resolver.login(input)).resolves.toEqual(payload);
    expect(login).toHaveBeenCalledWith(input);
  });
});
