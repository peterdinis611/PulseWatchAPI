process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./data/test.sqlite';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';

import { spawnSync } from 'node:child_process';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createListeningTestingApp } from './create-testing-app';

interface GraphQLBody<T> {
  data?: T;
  errors?: { message: string }[];
}

interface AuthPayloadBody {
  accessToken: string;
  user: { id: string };
}

interface StressTestBody {
  id: string;
  name: string;
  url: string;
  method: string;
  vus: number;
  durationSec: number;
  lastStatus: string;
}

async function gql<T>(
  app: INestApplication<App>,
  query: string,
  options?: { token?: string; variables?: Record<string, unknown> },
): Promise<GraphQLBody<T>> {
  const req = request(app.getHttpServer()).post('/graphql');
  if (options?.token) {
    req.set('Authorization', `Bearer ${options.token}`);
  }
  const res = await req
    .send({ query, variables: options?.variables })
    .expect(200);
  return res.body as GraphQLBody<T>;
}

async function register(
  app: INestApplication<App>,
  email: string,
): Promise<AuthPayloadBody> {
  const body = await gql<{ register: AuthPayloadBody }>(
    app,
    `
      mutation Register($input: RegisterInput!) {
        register(input: $input) {
          accessToken
          user { id }
        }
      }
    `,
    {
      variables: { input: { email, password: 'password1' } },
    },
  );
  const registered = body.data?.register;
  if (!registered) {
    throw new Error(body.errors?.[0]?.message ?? 'register failed');
  }
  return registered;
}

const STRESS_TEST_FIELDS = `
  id
  name
  url
  method
  vus
  durationSec
  lastStatus
`;

describe('Stress tests (e2e)', () => {
  let app: INestApplication<App>;
  let port: number;

  beforeEach(async () => {
    ({ app, port } = await createListeningTestingApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates, lists, updates and deletes a k6 stress test', async () => {
    const auth = await register(app, `stress-${Date.now()}@pulsewatch.dev`);

    const created = await gql<{ createStressTest: StressTestBody }>(
      app,
      `
        mutation Create($input: CreateStressTestInput!) {
          createStressTest(input: $input) {
            ${STRESS_TEST_FIELDS}
          }
        }
      `,
      {
        token: auth.accessToken,
        variables: {
          input: {
            name: 'Checkout load',
            url: 'https://example.com/checkout',
            vus: 5,
            durationSec: 10,
            p95Ms: 400,
            maxFailRate: 0.05,
          },
        },
      },
    );

    expect(created.errors).toBeUndefined();
    expect(created.data?.createStressTest).toEqual(
      expect.objectContaining({
        name: 'Checkout load',
        url: 'https://example.com/checkout',
        method: 'GET',
        vus: 5,
        durationSec: 10,
        lastStatus: 'IDLE',
      }),
    );

    const id = created.data?.createStressTest.id;
    expect(id).toBeDefined();

    const listed = await gql<{ stressTests: StressTestBody[] }>(
      app,
      `query { stressTests { ${STRESS_TEST_FIELDS} } }`,
      { token: auth.accessToken },
    );
    expect(listed.data?.stressTests).toHaveLength(1);

    const updated = await gql<{ updateStressTest: StressTestBody }>(
      app,
      `
        mutation Update($id: String!, $input: UpdateStressTestInput!) {
          updateStressTest(id: $id, input: $input) {
            ${STRESS_TEST_FIELDS}
          }
        }
      `,
      {
        token: auth.accessToken,
        variables: { id, input: { name: 'Checkout load v2', vus: 8 } },
      },
    );
    expect(updated.data?.updateStressTest.name).toBe('Checkout load v2');
    expect(updated.data?.updateStressTest.vus).toBe(8);

    const runs = await gql<{ stressTestRuns: { id: string }[] }>(
      app,
      `
        query Runs($id: String!) {
          stressTestRuns(id: $id) { id }
        }
      `,
      { token: auth.accessToken, variables: { id } },
    );
    expect(runs.data?.stressTestRuns).toEqual([]);

    const deleted = await gql<{ deleteStressTest: boolean }>(
      app,
      `
        mutation Delete($id: String!) {
          deleteStressTest(id: $id)
        }
      `,
      { token: auth.accessToken, variables: { id } },
    );
    expect(deleted.data?.deleteStressTest).toBe(true);
  });

  it('rejects an unauthenticated list', async () => {
    const body = await gql<{ stressTests: StressTestBody[] }>(
      app,
      `query { stressTests { id } }`,
    );
    expect(body.errors?.[0]?.message).toMatch(/unauthorized/i);
  });

  it('rejects out-of-range VUs and duration', async () => {
    const auth = await register(
      app,
      `stress-limits-${Date.now()}@pulsewatch.dev`,
    );

    const tooManyVus = await gql(
      app,
      `
      mutation Create($input: CreateStressTestInput!) {
        createStressTest(input: $input) { id }
      }
    `,
      {
        token: auth.accessToken,
        variables: {
          input: {
            name: 'Too heavy',
            url: 'https://example.com',
            vus: 51,
          },
        },
      },
    );
    expect(tooManyVus.errors?.[0]?.message).toMatch(/vus|50/i);

    const tooShort = await gql(
      app,
      `
      mutation Create($input: CreateStressTestInput!) {
        createStressTest(input: $input) { id }
      }
    `,
      {
        token: auth.accessToken,
        variables: {
          input: {
            name: 'Too short',
            url: 'https://example.com',
            durationSec: 3,
          },
        },
      },
    );
    expect(tooShort.errors?.[0]?.message).toMatch(/duration/i);
  });
});

const k6Installed = (() => {
  try {
    return spawnSync('k6', ['version'], { encoding: 'utf8' }).status === 0;
  } catch {
    return false;
  }
})();

(k6Installed ? describe : describe.skip)('Stress tests live k6 (e2e)', () => {
  let app: INestApplication<App>;
  let port: number;

  beforeEach(async () => {
    ({ app, port } = await createListeningTestingApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('runs a 2-VU load against the local health endpoint', async () => {
    const auth = await register(
      app,
      `stress-live-${Date.now()}@pulsewatch.dev`,
    );

    const created = await gql<{
      createStressTest: { id: string; lastStatus: string };
    }>(
      app,
      `
          mutation Create($input: CreateStressTestInput!) {
            createStressTest(input: $input) { id lastStatus }
          }
        `,
      {
        token: auth.accessToken,
        variables: {
          input: {
            name: 'Health load',
            url: `http://127.0.0.1:${port}/health`,
            vus: 2,
            durationSec: 5,
            expectedStatus: 200,
            p95Ms: 5_000,
            maxFailRate: 0.1,
          },
        },
      },
    );
    expect(created.errors).toBeUndefined();
    const id = created.data?.createStressTest.id;
    expect(id).toBeDefined();

    const started = await gql<{
      runStressTest: { lastStatus: string };
    }>(
      app,
      `
          mutation Run($id: String!) {
            runStressTest(id: $id) { lastStatus }
          }
        `,
      { token: auth.accessToken, variables: { id } },
    );
    expect(started.data?.runStressTest.lastStatus).toBe('RUNNING');

    const finished = await waitForRun(app, auth.accessToken, id!);
    expect(finished.lastStatus).toBe('PASSED');
    expect(finished.lastSummary?.httpReqs).toBeGreaterThan(0);
    expect(finished.lastSummary?.failRate).toBe(0);

    const runs = await gql<{
      stressTestRuns: {
        status: string;
        summary: { httpReqs: number | null };
      }[];
    }>(
      app,
      `
          query Runs($id: String!) {
            stressTestRuns(id: $id) {
              status
              summary { httpReqs }
            }
          }
        `,
      { token: auth.accessToken, variables: { id } },
    );
    expect(runs.data?.stressTestRuns[0]?.status).toBe('PASSED');
  }, 30_000);
});

async function waitForRun(
  app: INestApplication<App>,
  token: string,
  id: string,
): Promise<{
  lastStatus: string;
  lastError: string | null;
  lastSummary: { httpReqs: number | null; failRate: number | null } | null;
}> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const body = await gql<{
      stressTest: {
        lastStatus: string;
        lastError: string | null;
        lastSummary: {
          httpReqs: number | null;
          failRate: number | null;
        } | null;
      };
    }>(
      app,
      `
        query Status($id: String!) {
          stressTest(id: $id) {
            lastStatus
            lastError
            lastSummary { httpReqs failRate }
          }
        }
      `,
      { token, variables: { id } },
    );
    const current = body.data?.stressTest;
    if (
      current &&
      (current.lastStatus === 'PASSED' || current.lastStatus === 'FAILED')
    ) {
      return current;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for k6 stress test to finish');
}
