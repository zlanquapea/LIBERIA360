import { excessMileage, rentalDays, rentalHours, rentalSteps, timeLeft } from './rentals';

describe('rental helpers', () => {
  it('walks booked, confirmed, picked up and returned', () => {
    expect(rentalSteps({ status: 'confirmed' }).map((s) => s.state)).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(rentalSteps({ status: 'returned' }).every((s) => s.state === 'done')).toBe(true);
  });

  it('counts days and hours the way the owner charges them', () => {
    expect(rentalDays('2026-10-10', '2026-10-13')).toBe(3);
    expect(rentalDays('2026-10-10', '2026-10-10')).toBe(1);
    expect(rentalHours('09:00', '12:30')).toBe(4);
    expect(rentalHours('12:00', '09:00')).toBe(0);
  });

  it('prices only the miles over the allowance', () => {
    const r = { mileageLimitPerDay: 100, excessMileageFee: 0.5, units: 3, rentalUnit: 'day' as const };
    expect(excessMileage(r, 450)).toEqual({ over: 150, charge: 75 });
    expect(excessMileage(r, 250)).toEqual({ over: 0, charge: 0 });
  });

  it('says how long until the car is due, or how late it is', () => {
    const now = Date.parse('2026-10-10T10:00:00Z');
    expect(timeLeft('2026-10-11T12:00:00Z', now)).toEqual({ late: false, text: '1d 2h' });
    expect(timeLeft('2026-10-10T09:30:00Z', now)).toEqual({ late: true, text: '30m' });
  });
});
