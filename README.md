# PulseWatch backend

NestJS GraphQL API so SQLite (Prisma).

## Stack

- NestJS 11
- GraphQL (code-first, Apollo)
- Prisma 7 + SQLite (`better-sqlite3` adapter)
- `@nestjs/config`

## Setup

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run start:dev
```

- REST health: [http://localhost:4000/health](http://localhost:4000/health)
- GraphQL (Apollo Sandbox): [http://localhost:4000/graphql](http://localhost:4000/graphql)

```graphql
query {
  health {
    status
    database
    timestamp
  }
}
```

SQLite súbor je v `data/pulsewatch.sqlite`. Schéma je v `prisma/schema.prisma`.

## Scripts

```bash
npm run start:dev
npm run prisma:migrate
npm run prisma:studio
npm run test
npm run test:e2e
npm run build
```
