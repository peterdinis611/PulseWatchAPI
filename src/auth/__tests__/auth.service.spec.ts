import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { LoggerService } from '../../logger/logger.service';
import { UserService } from '../../user/user.service';
import { AuthService } from '../auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let findByEmail: jest.Mock;
  let create: jest.Mock;
  let sign: jest.Mock;

  const publicUser = {
    id: 'user-1',
    email: 'ada@pulsewatch.dev',
    name: 'Ada',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    findByEmail = jest.fn();
    create = jest.fn().mockResolvedValue(publicUser);
    sign = jest.fn().mockReturnValue('jwt-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: { findByEmail, create },
        },
        {
          provide: JwtService,
          useValue: { sign },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('registers a user and returns a JWT', async () => {
    const result = await service.register({
      email: 'Ada@PulseWatch.dev',
      password: 'password1',
      name: 'Ada',
    });

    expect(create).toHaveBeenCalledTimes(1);
    const calls = create.mock.calls as unknown as Array<
      [{ email: string; name: string; passwordHash: string }]
    >;
    const created = calls[0][0];
    expect(created.email).toBe('ada@pulsewatch.dev');
    expect(created.name).toBe('Ada');
    expect(created.passwordHash.length).toBeGreaterThan(10);
    expect(sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'ada@pulsewatch.dev',
    });
    expect(result).toEqual({
      accessToken: 'jwt-token',
      user: publicUser,
    });
  });

  it('logs in with valid credentials', async () => {
    const passwordHash = await bcrypt.hash('password1', 10);
    findByEmail.mockResolvedValue({ ...publicUser, passwordHash });

    const result = await service.login({
      email: 'ada@pulsewatch.dev',
      password: 'password1',
    });

    expect(result.accessToken).toBe('jwt-token');
    expect(result.user).toEqual(publicUser);
  });

  it('rejects unknown emails', async () => {
    findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@pulsewatch.dev', password: 'password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid passwords', async () => {
    const passwordHash = await bcrypt.hash('password1', 10);
    findByEmail.mockResolvedValue({ ...publicUser, passwordHash });

    await expect(
      service.login({ email: 'ada@pulsewatch.dev', password: 'wrongpass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
