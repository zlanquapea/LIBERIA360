const ORIGINAL_ENV = process.env;

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
});
