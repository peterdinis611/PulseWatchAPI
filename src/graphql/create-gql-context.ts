import { Request } from 'express';

type ConnectionParams = Record<string, unknown>;

type WsContext = {
  req?: Request;
  extra?: {
    authorization?: string;
    request?: {
      headers?: Record<string, string | string[] | undefined>;
    };
  };
  connectionParams?: ConnectionParams;
};

function asHeader(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

export function createGqlContext(ctx: WsContext): { req: Request } {
  if (ctx.req) {
    return { req: ctx.req };
  }

  const params = ctx.connectionParams ?? {};
  const authorization =
    ctx.extra?.authorization ??
    asHeader(params.Authorization) ??
    asHeader(params.authorization) ??
    asHeader(ctx.extra?.request?.headers?.authorization);

  return {
    req: {
      headers: { authorization },
    } as Request,
  };
}
