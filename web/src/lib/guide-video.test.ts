import { guideVideoSource } from './guide-video';

describe('guideVideoSource', () => {
  it('embeds YouTube links via the no-cookie domain', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      expect(guideVideoSource(url)).toEqual({
        kind: 'embed',
        src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0',
      });
    }
  });

  it('embeds Vimeo with do-not-track', () => {
    expect(guideVideoSource('https://vimeo.com/123456789')).toEqual({
      kind: 'embed',
      src: 'https://player.vimeo.com/video/123456789?autoplay=1&dnt=1',
    });
  });

  it('plays uploaded files directly and refuses anything else', () => {
    expect(guideVideoSource('/uploads/videos/a.mp4')).toEqual({ kind: 'file', src: '/uploads/videos/a.mp4' });
    expect(guideVideoSource('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(guideVideoSource('https://example.com/video')).toBeNull();
    expect(guideVideoSource(null)).toBeNull();
  });
});
