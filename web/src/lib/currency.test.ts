import { convertMoney, formatMoney, formatPriceIn, otherCurrency } from './currency';

describe('formatMoney', () => {
  it('formats USD with cents and thousands separators', () => {
    expect(formatMoney(1250.5, 'USD')).toBe('US$1,250.50');
    expect(formatMoney(3, 'USD')).toBe('US$3.00');
  });

  it('formats LRD as whole dollars unless cents were entered', () => {
    expect(formatMoney(1900, 'LRD')).toBe('L$1,900');
    expect(formatMoney(950.5, 'LRD')).toBe('L$950.5');
  });
});

describe('convertMoney', () => {
  it('returns the same amount for the same currency, even without a rate', () => {
    expect(convertMoney(10, 'USD', 'USD', null)).toBe(10);
  });

  it('converts both directions with the USD→LRD rate', () => {
    expect(convertMoney(10, 'USD', 'LRD', 190)).toBe(1900);
    expect(convertMoney(1900, 'LRD', 'USD', 190)).toBe(10);
  });

  it('returns null without a usable rate', () => {
    expect(convertMoney(10, 'USD', 'LRD', null)).toBeNull();
    expect(convertMoney(10, 'USD', 'LRD', 0)).toBeNull();
  });
});

describe('formatPriceIn', () => {
  it('shows the menu price as-is in its own currency', () => {
    expect(formatPriceIn(10, 'USD', 'USD', 190)).toBe('US$10.00');
  });

  it('shows an estimate when displaying in the other currency', () => {
    expect(formatPriceIn(10.25, 'USD', 'LRD', 190)).toBe('≈ L$1,948');
    expect(formatPriceIn(1900, 'LRD', 'USD', 190)).toBe('≈ US$10.00');
  });

  it('falls back to the menu currency with no rate set', () => {
    expect(formatPriceIn(10, 'USD', 'LRD', null)).toBe('US$10.00');
  });
});

describe('otherCurrency', () => {
  it('flips between the two currencies', () => {
    expect(otherCurrency('USD')).toBe('LRD');
    expect(otherCurrency('LRD')).toBe('USD');
  });
});
