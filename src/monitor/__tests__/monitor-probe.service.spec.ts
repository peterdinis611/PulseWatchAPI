import { createServer, Server } from 'node:net';
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
});

function listen(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
