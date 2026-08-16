import { apiRequest, authHeader, HttpError } from './http';

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe('apiRequest', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the parsed JSON body on success', async () => {
    mockFetchOnce(200, { id: '1', name: 'Test' });
    const result = await apiRequest<{ id: string; name: string }>('/places/1');
    expect(result).toEqual({ id: '1', name: 'Test' });
  });

  it('sends Content-Type: application/json by default, merged with any extra headers', async () => {
    mockFetchOnce(200, {});
    await apiRequest('/auth/me', { headers: { Authorization: 'Bearer xyz' } });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer xyz',
    });
  });

  it('throws HttpError with a single joined string when the API returns a class-validator string[] message', async () => {
    mockFetchOnce(400, { message: ['email must be an email', 'password is too short'] });
    await expect(apiRequest('/auth/register')).rejects.toMatchObject({
      status: 400,
      message: 'email must be an email, password is too short',
    });
  });

  it('throws HttpError with the plain message when the API returns a single string', async () => {
    mockFetchOnce(401, { message: 'Invalid credentials' });
    await expect(apiRequest('/auth/login')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid credentials',
    });
  });

  it('falls back to a generic message when the error body has no usable message field', async () => {
    mockFetchOnce(500, {});
    await expect(apiRequest('/places')).rejects.toMatchObject({
      status: 500,
      message: 'Request to /places failed with 500',
    });
  });

  it('treats a response with no parseable JSON body as null rather than throwing on .json()', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.reject(new Error('Unexpected end of JSON input')),
    }) as unknown as typeof fetch;
    await expect(apiRequest('/places/unknown')).rejects.toBeInstanceOf(HttpError);
  });
});

describe('authHeader', () => {
  it('builds a Bearer authorization header', () => {
    expect(authHeader('abc123')).toEqual({ Authorization: 'Bearer abc123' });
  });
});
