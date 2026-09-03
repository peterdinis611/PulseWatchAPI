import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache.keys';
import { PublicUser } from './public-user';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  findByEmail(email: string): Promise<{
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    passwordHash: string;
  } | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findPublicById(id: string): Promise<PublicUser> {
    return this.cache.wrap(
      CacheKeys.userPublic(id),
      async () => {
        const user = await this.prisma.user.findUnique({
          where: { id },
          select: publicUserSelect,
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        return user;
      },
      this.cache.userTtlMs,
    );
  }

  async create(data: {
    email: string;
    passwordHash: string;
    name?: string;
  }): Promise<PublicUser> {
    try {
      return await this.prisma.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          name: data.name,
        },
        select: publicUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }
}
