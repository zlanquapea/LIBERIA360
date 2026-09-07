const ORIGINAL_ENV = process.env;

// next-intl/plugin locates its request-config file relative to the caller
// (next.config.js) using Node internals that assume they're being invoked
// by Next's own config loader — requiring next.config.js directly from
// Jest, as this file does, trips that up. None of these tests touch i18n
// at all (just the API proxy rewrite destinations), so a pass-through
// identity plugin sidesteps it entirely.
jest.mock('next-intl/plugin', () => () => (config) => config);

async function destinations(env) {
  process.env = { ...ORIGINAL_ENV, ...env };
  jest.resetModules();
  const config = require('./next.config');
  return config.rewrites();
}

describe('API proxy upstream configuration', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  it('uses API_ORIGIN when configured', async () => {
    const rewrites = await destinations({
      API_ORIGIN: 'https://api.internal.railway.app/',
      NEXT_PUBLIC_API_URL: 'https://legacy.example/api/v1',
    });

    expect(rewrites[0].destination).toBe(
      'https://api.internal.railway.app/api/:path*',
    );
  });

  it('supports and normalizes the legacy Railway API URL', async () => {
    const rewrites = await destinations({
      API_ORIGIN: '',
      NEXT_PUBLIC_API_URL: 'https://api.example.com/api/v1/',
    });

    expect(rewrites).toEqual([
      {
        source: '/api/:path*',
        destination: 'https://api.example.com/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'https://api.example.com/uploads/:path*',
      },
    ]);
  });

  it('builds a private origin from a platform-provided host and port', async () => {
    const rewrites = await destinations({
      API_ORIGIN: '',
      API_HOST: 'liberia360-api',
      API_PORT: '10000',
      NEXT_PUBLIC_API_URL: '',
    });

    expect(rewrites[0].destination).toBe(
      'http://liberia360-api:10000/api/:path*',
    );
  });
});
