import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user.service';

describe('UserService', () => {
  let service: UserService;
  let findUnique: jest.Mock;
  let create: jest.Mock;

  const publicUser = {
    id: 'user-1',
    email: 'ada@pulsewatch.dev',
    name: 'Ada',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    findUnique = jest.fn();
    create = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique, create },
          },
        },
      ],
    }).compile();

    service = module.get(UserService);
  });

  it('finds a user by email', async () => {
    findUnique.mockResolvedValue({ ...publicUser, passwordHash: 'hash' });

    await expect(service.findByEmail('ada@pulsewatch.dev')).resolves.toEqual({
      ...publicUser,
      passwordHash: 'hash',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'ada@pulsewatch.dev' },
    });
  });

  it('returns a public user by id', async () => {
    findUnique.mockResolvedValue(publicUser);

    await expect(service.findPublicById('user-1')).resolves.toEqual(publicUser);
  });

  it('throws when public user is missing', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.findPublicById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a user', async () => {
    create.mockResolvedValue(publicUser);

    await expect(
      service.create({
        email: 'ada@pulsewatch.dev',
        passwordHash: 'hash',
        name: 'Ada',
      }),
    ).resolves.toEqual(publicUser);
  });

  it('maps unique email conflicts', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '7.10.0',
      },
    );
    create.mockRejectedValue(error);

    await expect(
      service.create({
        email: 'ada@pulsewatch.dev',
        passwordHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
