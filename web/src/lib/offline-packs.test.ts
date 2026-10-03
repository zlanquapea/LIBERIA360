import { packImageUrls } from './offline-packs';
import type { ItineraryStopDetail } from './types';

const stop = (images: string[]): ItineraryStopDetail =>
  ({ day: 1, order: 0, notes: null, place: { images } }) as unknown as ItineraryStopDetail;

describe('packImageUrls', () => {
  it('keeps same-origin photos once each, and skips other hosts and data URIs', () => {
    const urls = packImageUrls(
      [
        stop(['/uploads/a.jpg']),
        stop(['/uploads/a.jpg']),
        stop(['https://tiles.example.com/x.png']),
        stop(['data:image/svg+xml,<svg/>']),
        stop([]),
      ],
      'http://localhost',
    );
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^http:\/\/localhost\/.*a/);
  });

  it('caps the number of photos', () => {
    const many = Array.from({ length: 60 }, (_, i) => stop([`/uploads/p${i}.jpg`]));
    expect(packImageUrls(many, 'http://localhost').length).toBe(40);
  });
});
