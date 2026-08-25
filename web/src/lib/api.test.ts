// apiFetch's build-phase fallback reads `process.env.NEXT_PHASE` into a
// module-level const at import time, so each case here resets the module
// registry and re-imports with the env var set (or unset) beforehand —
// changing `process.env.NEXT_PHASE` after import wouldn't do anything.
const ORIGINAL_ENV = process.env;

function loadApiModule(nextPhase?: string): typeof import('./api') {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, NEXT_PHASE: nextPhase };
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
