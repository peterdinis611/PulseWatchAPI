import { Resolver } from 'node:dns/promises';
import { createServer as createTcpServer, Server } from 'node:net';
import { createServer as createTlsServer, Server as TlsServer } from 'node:tls';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AddressInfo } from 'node:net';
import { MonitorProbeService } from '../monitor-probe.service';
import { MonitorStatus } from '../monitor-status';
import { MonitorType } from '../monitor-type';

describe('MonitorProbeService', () => {
  const probe = new MonitorProbeService();

  it('marks HTTP as up when the status matches', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      probe.probe(
        MonitorType.HTTP,
        {
          url: 'https://example.com/health',
          method: 'GET',
          expectedStatus: 200,
        },
        1000,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: MonitorStatus.UP,
        error: null,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('marks HTTP as down on timeout', async () => {
    const timeout = new Error('The operation was aborted');
    timeout.name = 'TimeoutError';
    global.fetch = jest
      .fn()
      .mockRejectedValue(timeout) as unknown as typeof fetch;

    const result = await probe.probe(
      MonitorType.HTTP,
      { url: 'https://example.com/health', expectedStatus: 200 },
      1000,
    );

    expect(result.status).toBe(MonitorStatus.DOWN);
    expect(result.error).toBe('Request timed out');
  });

  it('marks HTTP as down on an unexpected status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 503,
    }) as unknown as typeof fetch;

    const result = await probe.probe(
      MonitorType.HTTP,
      { url: 'https://example.com/health', expectedStatus: 200 },
      1000,
    );

    expect(result.status).toBe(MonitorStatus.DOWN);
    expect(result.error).toMatch(/Expected HTTP 200, received 503/);
  });

  it('marks TCP as up when the port accepts a connection', async () => {
    const server = await listen();
    const port = (server.address() as AddressInfo).port;

    try {
      const result = await probe.probe(
        MonitorType.TCP,
        { host: '127.0.0.1', port },
        1000,
      );
      expect(result.status).toBe(MonitorStatus.UP);
    } finally {
      await close(server);
    }
  });

  it('marks TCP as down when nothing is listening', async () => {
    const result = await probe.probe(
      MonitorType.TCP,
      { host: '127.0.0.1', port: 1 },
      500,
    );
    expect(result.status).toBe(MonitorStatus.DOWN);
    expect(result.error).toEqual(expect.any(String));
  });

  it('marks SSL as up for a TLS listener with allowUnauthorized', async () => {
    const { key, cert } = selfSigned();
    const server = await listenTls(key, cert);
    const port = (server.address() as AddressInfo).port;

    try {
      const result = await probe.probe(
        MonitorType.SSL,
        {
          host: '127.0.0.1',
          port,
          serverName: 'localhost',
          allowUnauthorized: true,
        },
        2000,
      );
      expect(result.status).toBe(MonitorStatus.UP);
    } finally {
      await close(server);
    }
  });

  it('marks SSL as down for a self-signed cert by default', async () => {
    const { key, cert } = selfSigned();
    const server = await listenTls(key, cert);
    const port = (server.address() as AddressInfo).port;

    try {
      const result = await probe.probe(
        MonitorType.SSL,
        { host: '127.0.0.1', port, serverName: 'localhost' },
        2000,
      );
      expect(result.status).toBe(MonitorStatus.DOWN);
      expect(result.error).toBe('TLS certificate error');
    } finally {
      await close(server);
    }
  });

  it('marks SSL as down when the certificate expires too soon', async () => {
    const { key, cert } = selfSigned();
    const server = await listenTls(key, cert);
    const port = (server.address() as AddressInfo).port;

    try {
      const result = await probe.probe(
        MonitorType.SSL,
        {
          host: '127.0.0.1',
          port,
          serverName: 'localhost',
          allowUnauthorized: true,
          minDaysUntilExpiry: 365,
        },
        2000,
      );
      expect(result.status).toBe(MonitorStatus.DOWN);
      expect(result.error).toMatch(/expires in \d+ days/);
    } finally {
      await close(server);
    }
  });

  it('marks DNS as up when records include the expected value', async () => {
    const spy = jest
      .spyOn(Resolver.prototype, 'resolve4')
      .mockResolvedValue(['93.184.216.34']);

    try {
      const result = await probe.probe(
        MonitorType.DNS,
        {
          host: 'example.com',
          recordType: 'A',
          expectedValue: '93.184.216.34',
        },
        1000,
      );
      expect(result.status).toBe(MonitorStatus.UP);
    } finally {
      spy.mockRestore();
    }
  });

  it('marks SMTP as up after a 220 greeting and EHLO', async () => {
    const server = await listenSmtp();
    const port = (server.address() as AddressInfo).port;

    try {
      const result = await probe.probe(
        MonitorType.SMTP,
        { host: '127.0.0.1', port },
        2000,
      );
      expect(result.status).toBe(MonitorStatus.UP);
    } finally {
      await close(server);
    }
  });

  it('marks Kafka as down when the broker is unreachable', async () => {
    const result = await probe.probe(
      MonitorType.KAFKA,
      { host: '127.0.0.1', port: 1 },
      1000,
    );
    expect(result.status).toBe(MonitorStatus.DOWN);
  });

  it('marks gRPC as down when nothing is listening', async () => {
    const result = await probe.probe(
      MonitorType.GRPC,
      { host: '127.0.0.1', port: 1 },
      1000,
    );
    expect(result.status).toBe(MonitorStatus.DOWN);
  });
});

function listen(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createTcpServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function listenSmtp(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createTcpServer((socket) => {
      socket.write('220 pulsewatch.test ESMTP\r\n');
      socket.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (text.startsWith('EHLO') || text.startsWith('HELO')) {
          socket.write('250 hello\r\n');
        } else if (text.startsWith('QUIT')) {
          socket.write('221 bye\r\n');
          socket.end();
        }
      });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function listenTls(key: string, cert: string): Promise<TlsServer> {
  return new Promise((resolve, reject) => {
    const server = createTlsServer({ key, cert });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function close(server: Server | TlsServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function selfSigned(): { key: string; cert: string } {
  const dir = mkdtempSync(join(tmpdir(), 'pulsewatch-ssl-'));
  try {
    const keyPath = join(dir, 'key.pem');
    const certPath = join(dir, 'cert.pem');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-keyout',
        keyPath,
        '-out',
        certPath,
        '-days',
        '30',
        '-nodes',
        '-subj',
        '/CN=localhost',
      ],
      { stdio: 'pipe' },
    );
    return {
      key: readFileSync(keyPath, 'utf8'),
      cert: readFileSync(certPath, 'utf8'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
