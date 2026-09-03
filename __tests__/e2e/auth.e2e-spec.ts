process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./data/test.sqlite';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestingApp } from './create-testing-app';

interface GraphQLBody<T> {
  data?: T;
  errors?: { message: string }[];
}

interface AuthPayloadBody {
  accessToken: string;
  user: { id: string; email: string; name: string | null };
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const email = `ada-${Date.now()}@pulsewatch.dev`;

  beforeEach(async () => {
    app = await createTestingApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers, logs in, and returns the current user', async () => {
    const http = app.getHttpServer();

    const registerRes = await request(http)
      .post('/graphql')
      .send({
        query: `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              accessToken
              user { id email name }
            }
          }
        `,
        variables: {
          input: { email, password: 'password1', name: 'Ada' },
        },
      })
      .expect(200);

    const registered = (
      registerRes.body as GraphQLBody<{ register: AuthPayloadBody }>
    ).data?.register;
    expect(registered?.accessToken).toEqual(expect.any(String));
    expect(registered?.user.email).toBe(email);

    const loginRes = await request(http)
      .post('/graphql')
      .send({
        query: `
          mutation Login($input: LoginInput!) {
            login(input: $input) {
              accessToken
              user { email }
            }
          }
        `,
        variables: {
          input: { email, password: 'password1' },
        },
      })
      .expect(200);

    const token = (loginRes.body as GraphQLBody<{ login: AuthPayloadBody }>)
      .data?.login.accessToken;
    expect(token).toEqual(expect.any(String));

    const meRes = await request(http)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: '{ me { email name } }' })
      .expect(200);

    const me = (
      meRes.body as GraphQLBody<{ me: { email: string; name: string } }>
    ).data?.me;
    expect(me).toEqual({ email, name: 'Ada' });
  });

  it('rejects unauthenticated me queries', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ me { email } }' })
      .expect(200);

    const body = res.body as GraphQLBody<unknown>;
    expect(body.errors?.[0]?.message).toMatch(/Unauthorized/i);
  });

  it('rejects invalid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation Login($input: LoginInput!) {
            login(input: $input) { accessToken }
          }
        `,
        variables: {
          input: { email: 'nobody@pulsewatch.dev', password: 'password1' },
        },
      })
      .expect(200);

    const body = res.body as GraphQLBody<unknown>;
    expect(body.errors?.[0]?.message).toMatch(/Invalid credentials/i);
  });
});
