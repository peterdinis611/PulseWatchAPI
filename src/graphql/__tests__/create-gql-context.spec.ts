import { Request } from 'express';
import { createGqlContext } from '../create-gql-context';

describe('createGqlContext', () => {
  it('returns the HTTP request when present', () => {
    const req = { headers: { authorization: 'Bearer http' } } as Request;

    expect(createGqlContext({ req })).toEqual({ req });
  });

  it('builds a request from connectionParams.Authorization', () => {
    const { req } = createGqlContext({
      connectionParams: { Authorization: 'Bearer params' },
    });

    expect(req.headers.authorization).toBe('Bearer params');
  });

  it('builds a request from connectionParams.authorization', () => {
    const { req } = createGqlContext({
      connectionParams: { authorization: 'Bearer lowercase' },
    });

    expect(req.headers.authorization).toBe('Bearer lowercase');
  });

  it('prefers extra.authorization over connection params', () => {
    const { req } = createGqlContext({
      extra: { authorization: 'Bearer extra' },
      connectionParams: { Authorization: 'Bearer params' },
    });

    expect(req.headers.authorization).toBe('Bearer extra');
  });

  it('falls back to the upgrade request Authorization header', () => {
    const { req } = createGqlContext({
      extra: {
        request: { headers: { authorization: 'Bearer upgrade' } },
      },
    });

    expect(req.headers.authorization).toBe('Bearer upgrade');
  });
});
