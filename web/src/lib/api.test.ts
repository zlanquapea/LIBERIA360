// apiFetch's build-phase fallback reads `process.env.NEXT_PHASE` into a
// module-level const at import time, so each case here resets the module
// registry and re-imports with the env var set (or unset) beforehand —
// changing `process.env.NEXT_PHASE` after import wouldn't do anything.
const ORIGINAL_ENV = process.env;

describe('server API origin configuration', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  it('normalizes the legacy Railway URL when API_ORIGIN is absent', () => {
    process.env = {
      ...ORIGINAL_ENV,
      API_ORIGIN: '',
      NEXT_PUBLIC_API_URL: 'https://api.example.com/api/v1/',
    };
    const { serverApiOrigin } = require('./api') as typeof import('./api');

    expect(serverApiOrigin()).toBe('https://api.example.com');
  });

  it('prefers the server-only API_ORIGIN variable', () => {
    process.env = {
      ...ORIGINAL_ENV,
      API_ORIGIN: 'https://private-api.railway.app/',
      NEXT_PUBLIC_API_URL: 'https://legacy.example/api/v1',
    };
    const { serverApiOrigin } = require('./api') as typeof import('./api');

    expect(serverApiOrigin()).toBe('https://private-api.railway.app');
  });
});

function loadApiModule(
  nextPhase?: string,
  nodeEnv: NodeJS.ProcessEnv['NODE_ENV'] = ORIGINAL_ENV.NODE_ENV,
): typeof import('./api') {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, NEXT_PHASE: nextPhase, NODE_ENV: nodeEnv };
  return require('./api');
}

function mockFetchResolved(ok: boolean, status: number) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve('{}'),
  }) as unknown as typeof fetch;
}

describe('apiFetch build-time fallback', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('falls back to an empty result on a 502 during the build phase (API mid-redeploy behind a gateway)', async () => {
    mockFetchResolved(false, 502);
    const api = loadApiModule('phase-production-build');

    await expect(api.getEvents()).resolves.toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
    });
  });

  it('falls back on 503 and 504 too', async () => {
    for (const status of [503, 504]) {
      mockFetchResolved(false, status);
      const api = loadApiModule('phase-production-build');
      await expect(api.getCounties()).resolves.toEqual([]);
    }
  });

  it('still throws on a 502 outside the build phase — a real request should surface a real error', async () => {
    mockFetchResolved(false, 502);
    const api = loadApiModule(undefined);

    await expect(api.getEvents()).rejects.toThrow('failed with 502');
  });

  it('still throws on a non-gateway error status during the build phase — the API is up and something is actually wrong', async () => {
    mockFetchResolved(false, 500);
    const api = loadApiModule('phase-production-build');

    await expect(api.getEvents()).rejects.toThrow('failed with 500');
  });

  it('keeps falling back on a raw connection failure during the build phase (pre-existing behavior, unchanged)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) as unknown as typeof fetch;
    const api = loadApiModule('phase-production-build');

    await expect(api.getCounties()).resolves.toEqual([]);
  });
});

// Jest always runs with NODE_ENV=test, which apiFetch special-cases to an
// absolute API_URL — masking what a real browser actually gets: API_URL is
// the bare relative string "/api/v1" there. `new URL(...)` with no base
// requires an absolute string and throws TypeError: Invalid URL on a
// relative one, so every client component calling a lib/api.ts function
// (the account page's getCategories/getCounties, admin content's same
// pair, ...) would fail outright in the browser. Force a non-test
// NODE_ENV to exercise that real branch under jsdom's `window`.
describe('apiFetch in the browser', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('builds a resolvable absolute URL from the relative client-side API_URL instead of throwing', async () => {
    mockFetchResolved(true, 200);
    const api = loadApiModule(undefined, 'production');

    await expect(api.getCategories()).resolves.toBeDefined();
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toBe(`${window.location.origin}/api/v1/categories`);
  });
});
