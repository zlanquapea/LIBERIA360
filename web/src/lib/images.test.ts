import { coverImage, galleryImages, resolveImageUrl, resolveThumbUrl } from './images';

// NEXT_PUBLIC_API_URL isn't set in the test env, so resolveImageUrl falls
// back to its documented default (http://localhost:3001/api/v1), and the
// derived origin is http://localhost:3001.
const API_ORIGIN = 'http://localhost:3001';

describe('resolveImageUrl', () => {
  it('prefixes a relative /uploads path with the API origin', () => {
    expect(resolveImageUrl('/uploads/abc123.jpg')).toBe(`${API_ORIGIN}/uploads/abc123.jpg`);
  });

  it('adds a leading slash if the relative path is missing one', () => {
    expect(resolveImageUrl('uploads/abc123.jpg')).toBe(`${API_ORIGIN}/uploads/abc123.jpg`);
  });

  it('passes an http(s) URL through untouched', () => {
    expect(resolveImageUrl('https://cdn.example.com/photo.jpg')).toBe('https://cdn.example.com/photo.jpg');
    expect(resolveImageUrl('http://cdn.example.com/photo.jpg')).toBe('http://cdn.example.com/photo.jpg');
  });

  it('passes a data: URL through untouched', () => {
    const dataUrl = 'data:image/png;base64,AAAA';
    expect(resolveImageUrl(dataUrl)).toBe(dataUrl);
  });
});

describe('resolveThumbUrl', () => {
  const uuid = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

  it('derives the thumbnail path from a local /uploads path matching our own upload naming convention', () => {
    expect(resolveThumbUrl(`/uploads/${uuid}.jpg`)).toBe(`${API_ORIGIN}/uploads/${uuid}-thumb.jpg`);
  });

  it('derives the thumbnail path from an absolute S3/R2 URL matching the convention', () => {
    expect(resolveThumbUrl(`https://cdn.example.com/${uuid}.jpg`)).toBe(
      `https://cdn.example.com/${uuid}-thumb.jpg`,
    );
  });

  it('returns null for an admin-pasted external URL that is not one of our own uploads', () => {
    expect(resolveThumbUrl('https://images.unsplash.com/photo-12345')).toBeNull();
  });

  it('returns null for a data: URL', () => {
    expect(resolveThumbUrl('data:image/png;base64,AAAA')).toBeNull();
  });

  it('returns null for a non-UUID filename, even under /uploads', () => {
    expect(resolveThumbUrl('/uploads/photo.jpg')).toBeNull();
  });

  it('is idempotent when given an already-resolved absolute URL (safe to call on resolveImageUrl output)', () => {
    const already = resolveImageUrl(`/uploads/${uuid}.jpg`);
    expect(resolveThumbUrl(already)).toBe(`${API_ORIGIN}/uploads/${uuid}-thumb.jpg`);
  });
});

describe('coverImage', () => {
  it('prefers the business photo over the place photo', () => {
    expect(coverImage(['/uploads/place.jpg'], ['/uploads/business.jpg'])).toBe(
      `${API_ORIGIN}/uploads/business.jpg`,
    );
  });

  it('falls back to the place photo when there is no business photo', () => {
    expect(coverImage(['/uploads/place.jpg'], undefined)).toBe(`${API_ORIGIN}/uploads/place.jpg`);
    expect(coverImage(['/uploads/place.jpg'], [])).toBe(`${API_ORIGIN}/uploads/place.jpg`);
  });

  it('returns null when there are no photos at all', () => {
    expect(coverImage(undefined, undefined)).toBeNull();
    expect(coverImage([], [])).toBeNull();
  });
});

describe('galleryImages', () => {
  it('orders business photos first, then place photos', () => {
    const result = galleryImages(['/uploads/place1.jpg'], ['/uploads/biz1.jpg']);
    expect(result).toEqual([`${API_ORIGIN}/uploads/biz1.jpg`, `${API_ORIGIN}/uploads/place1.jpg`]);
  });

  it('dedupes a photo that appears in both lists', () => {
    const result = galleryImages(['/uploads/shared.jpg'], ['/uploads/shared.jpg']);
    expect(result).toEqual([`${API_ORIGIN}/uploads/shared.jpg`]);
  });

  it('returns an empty array when there are no photos', () => {
    expect(galleryImages(undefined, undefined)).toEqual([]);
  });
});
