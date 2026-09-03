import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaService } from '../prisma.service';

jest.mock('@prisma/adapter-better-sqlite3', () => ({
  PrismaBetterSqlite3: jest
    .fn()
    .mockImplementation((config: { url: string }) => ({
      url: config.url,
    })),
}));

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {
    $connect = jest.fn().mockResolvedValue(undefined);
    $disconnect = jest.fn().mockResolvedValue(undefined);

    constructor(public readonly options: { adapter: unknown }) {}
  },
}));

function createConfig(url: string | undefined) {
  return {
    get: (key: string) => (key === 'DATABASE_URL' ? url : undefined),
  } as unknown as ConfigService;
}

describe('PrismaService', () => {
  const url = 'file:./data/test.sqlite';
  const adapter = PrismaBetterSqlite3 as unknown as jest.Mock;

  beforeEach(() => {
    adapter.mockClear();
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => new PrismaService(createConfig(undefined))).toThrow(
      'DATABASE_URL is not set',
    );
    expect(() => new PrismaService(createConfig(''))).toThrow(
      'DATABASE_URL is not set',
    );
    expect(adapter).not.toHaveBeenCalled();
  });

  it('builds the SQLite adapter from DATABASE_URL', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: createConfig(url),
        },
      ],
    }).compile();

    const service = module.get(PrismaService);

    expect(adapter).toHaveBeenCalledWith({ url });
    expect(service).toBeInstanceOf(PrismaService);
  });

  it('connects on init and disconnects on destroy', async () => {
    const service = new PrismaService(createConfig(url));

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(service.$connect).toHaveBeenCalledTimes(1);
    expect(service.$disconnect).toHaveBeenCalledTimes(1);
  });
});
