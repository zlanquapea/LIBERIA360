import { distanceKm } from './geo';

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm({ lat: 6.3106, lng: -10.8047 }, { lat: 6.3106, lng: -10.8047 })).toBe(0);
  });

  it('matches the well-known London–Paris distance (~344 km)', () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    expect(distanceKm(london, paris)).toBeGreaterThan(340);
    expect(distanceKm(london, paris)).toBeLessThan(348);
  });

  it('is symmetric', () => {
    const a = { lat: 6.3106, lng: -10.8047 };
    const b = { lat: 6.4, lng: -10.9 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 10);
  });
});
