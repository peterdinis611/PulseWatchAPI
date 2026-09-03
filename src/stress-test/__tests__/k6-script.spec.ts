import { generateK6Script } from '../k6-script';

describe('generateK6Script', () => {
  it('embeds user values with JSON.stringify', () => {
    const script = generateK6Script({
      url: 'https://example.com/load"); process.exit(1); //',
      method: 'POST',
      vus: 5,
      durationSec: 12,
      expectedStatus: 201,
      p95Ms: 250,
      maxFailRate: 0.02,
    });

    expect(script).toContain(
      JSON.stringify('https://example.com/load"); process.exit(1); //'),
    );
    expect(script).toContain(JSON.stringify('POST'));
    expect(script).toContain('vus: 5');
    expect(script).toContain(JSON.stringify('12s'));
    expect(script).toContain('"checks":["rate==1"]');
    expect(script).toContain('"http_req_failed":["rate<0.02"]');
    expect(script).toContain('"http_req_duration":["p(95)<250"]');
    expect(script).toContain('r.status === 201');
    expect(script).toContain('PulseWatch-k6/0.0.1');
  });

  it('omits optional thresholds', () => {
    const script = generateK6Script({
      url: 'https://example.com',
      method: 'GET',
      vus: 10,
      durationSec: 30,
      expectedStatus: 200,
    });

    expect(script).not.toContain('http_req_failed');
    expect(script).not.toContain('http_req_duration');
    expect(script).toContain('"checks":["rate==1"]');
  });

  it('emits HEAD and DELETE requests', () => {
    expect(
      generateK6Script({
        url: 'https://example.com',
        method: 'HEAD',
        vus: 1,
        durationSec: 5,
        expectedStatus: 200,
      }),
    ).toContain(JSON.stringify('HEAD'));
    expect(
      generateK6Script({
        url: 'https://example.com',
        method: 'DELETE',
        vus: 1,
        durationSec: 5,
        expectedStatus: 204,
      }),
    ).toContain(JSON.stringify('DELETE'));
  });
});
