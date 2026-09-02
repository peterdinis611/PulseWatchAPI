import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '../user.service';
import { UserResolver } from '../user.resolver';

describe('UserResolver', () => {
  let resolver: UserResolver;
  let findPublicById: jest.Mock;

  const user = {
    id: 'user-1',
    email: 'ada@pulsewatch.dev',
    name: 'Ada',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    findPublicById = jest.fn().mockResolvedValue(user);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserResolver,
        {
          provide: UserService,
          useValue: { findPublicById },
        },
      ],
    }).compile();

    resolver = module.get(UserResolver);
  });

  it('returns the current user', async () => {
    await expect(resolver.me(user)).resolves.toEqual(user);
    expect(findPublicById).toHaveBeenCalledWith('user-1');
  });
});
