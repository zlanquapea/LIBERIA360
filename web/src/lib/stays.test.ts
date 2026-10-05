import { addDays, clockTime, stayDate, guestsLabel, nightsBetween, occupancyTone, staySteps } from './stays';

describe('stay helpers', () => {
  it('walks the stay through booked, confirmed, checked in and out', () => {
    expect(staySteps({ status: 'requested' }).map((s) => s.state)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
    expect(staySteps({ status: 'checked_in' }).map((s) => s.state)).toEqual(['done', 'done', 'current', 'upcoming']);
    expect(staySteps({ status: 'checked_out' }).every((s) => s.state === 'done')).toBe(true);
  });

  it('counts nights and formats times the way people say them', () => {
    expect(nightsBetween('2026-12-30', addDays('2026-12-30', 3))).toBe(3);
    expect(clockTime('14:00')).toBe('2pm');
    expect(clockTime('11:30')).toBe('11:30am');
    expect(guestsLabel(2, 1)).toBe('2 adults, 1 child');
    expect(stayDate('2026-10-09')).toBe('Fri 9 Oct');
  });

  it('colours rooms by how full they are', () => {
    expect(occupancyTone(0, 4)).toMatch(/red/);
    expect(occupancyTone(1, 4)).toMatch(/amber/);
    expect(occupancyTone(3, 4)).toMatch(/emerald/);
  });
});
