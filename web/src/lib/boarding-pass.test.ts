import { barcodeBars, destinationCode, passDate, tripDays } from './boarding-pass';

describe('boarding pass helpers', () => {
  it('codes a destination like an airport', () => {
    expect(destinationCode('Kpatawee Waterfall')).toBe('KPA');
    expect(destinationCode('ELWA Beach')).toBe('ELW');
    expect(destinationCode('Bo')).toBe('BOX');
    expect(destinationCode(null)).toBe('LBR');
  });

  it('counts trip days inclusively', () => {
    expect(tripDays('2026-10-17', '2026-10-19')).toBe(3);
    expect(tripDays('2026-10-17', '2026-10-17')).toBe(1);
    expect(tripDays('2026-10-17', null)).toBeNull();
  });

  it('formats the pass date in Liberia time', () => {
    expect(passDate('2026-10-17')).toBe('17 OCT');
  });

  it('makes a stable barcode per trip', () => {
    expect(barcodeBars('trip-1')).toEqual(barcodeBars('trip-1'));
    expect(barcodeBars('trip-1')).not.toEqual(barcodeBars('trip-2'));
    expect(barcodeBars('trip-1').every((w) => w >= 1 && w <= 3)).toBe(true);
  });
});
