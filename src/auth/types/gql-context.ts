import { Request } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
      name: string | null;
      createdAt: Date;
    };
  }
}

export type GqlContext = {
  req: Request;
};
