import { lrdHint, roundLrd } from './lrd';

describe('lrdHint', () => {
  it('converts at the admin rate and rounds like a quoted price', () => {
    expect(lrdHint(10, 193.5)).toBe('≈ L$1,950');
    expect(lrdHint(0.25, 190)).toBe('≈ L$48');
    expect(lrdHint(3, '190')).toBe('≈ L$570');
  });

  it('shows a range when there is a higher price', () => {
    expect(lrdHint(5, 190, 20)).toBe('≈ L$950 – L$3,800');
    expect(lrdHint(5, 190, 5)).toBe('≈ L$950');
  });

  it('says nothing without a rate, or for free and unlisted prices', () => {
    expect(lrdHint(10, null)).toBeNull();
    expect(lrdHint(10, 0)).toBeNull();
    expect(lrdHint(0, 190)).toBeNull();
    expect(lrdHint(null, 190)).toBeNull();
  });

  it('rounds by size', () => {
    expect(roundLrd(57.4)).toBe(57);
    expect(roundLrd(574)).toBe(570);
    expect(roundLrd(5740)).toBe(5750);
  });
});
