import { join } from 'node:path';
import {
  credentials,
  loadPackageDefinition,
  type ChannelCredentials,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';

export type GrpcHealthClient = {
  check: (
    request: { service: string },
    options: { deadline: number },
    callback: (
      error: Error | null,
      response?: { status?: string | number },
    ) => void,
  ) => void;
  close: () => void;
};

type HealthClientCtor = new (
  address: string,
  creds: ChannelCredentials,
) => GrpcHealthClient;

let cachedCtor: HealthClientCtor | undefined;

function healthClientCtor(): HealthClientCtor {
  if (cachedCtor) {
    return cachedCtor;
  }

  const packageDefinition = loadSync(
    join(__dirname, 'protos', 'health.proto'),
    {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
  );
  const proto = loadPackageDefinition(packageDefinition) as unknown as {
    grpc: {
      health: {
        v1: {
          Health: HealthClientCtor;
        };
      };
    };
  };
  cachedCtor = proto.grpc.health.v1.Health;
  return cachedCtor;
}

export function createGrpcHealthClient(
  address: string,
  tls: boolean,
  allowUnauthorized: boolean,
): GrpcHealthClient {
  const creds = tls
    ? credentials.createSsl(null, null, null, {
        rejectUnauthorized: !allowUnauthorized,
        checkServerIdentity: allowUnauthorized ? () => undefined : undefined,
      })
    : credentials.createInsecure();

  return new (healthClientCtor())(address, creds);
}
