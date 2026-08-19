import { parseUserAgent } from './user-agent';

describe('parseUserAgent', () => {
  it('returns "Unknown device" for null', () => {
    expect(parseUserAgent(null)).toBe('Unknown device');
  });

  it('identifies Chrome on Windows', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome on Windows');
  });

  it('identifies Safari on macOS, not Chrome', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      ),
    ).toBe('Safari on macOS');
  });

  it('identifies Safari on iOS', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iOS');
  });

  it('identifies Chrome on Android', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome on Android');
  });

  it('identifies Firefox on Linux', () => {
    expect(parseUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0')).toBe(
      'Firefox on Linux',
    );
  });

  it('identifies Edge, not Chrome, when both tokens are present', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      ),
    ).toBe('Edge on Windows');
  });

  it('falls back to the first token for a non-browser client (curl, scripts)', () => {
    expect(parseUserAgent('curl/8.5.0')).toBe('curl');
    expect(parseUserAgent('SmokeTest/1.0')).toBe('SmokeTest');
  });
});
