import {
  bookingSteps,
  countdown,
  dateRange,
  dueNow,
  itemIcon,
  money,
  priceLabel,
  slotsHeadline,
  spotsMessage,
  tripNights,
  whatsappLink,
} from './group-trips';

describe('group trip helpers', () => {
  it('writes prices the way posters do', () => {
    expect(money(150, 'USD')).toBe('US$150');
    expect(money(12.5, 'USD')).toBe('US$12.50');
    expect(priceLabel({ isFree: true, price: 0, currency: 'USD' })).toBe('Free');
    expect(priceLabel({ isFree: false, price: 5000, currency: 'LRD' })).toBe('L$5,000');
  });

  it('turns live spot counts into the scarcity line', () => {
    expect(slotsHeadline({ spots: 30, spotsLeft: 30 })).toBe('Only 30 slots available!');
    expect(slotsHeadline({ spots: 30, spotsLeft: 8 })).toBe('Only 8 of 30 slots left!');
    expect(slotsHeadline({ spots: 30, spotsLeft: 0 })).toMatch(/waitlist/);
    expect(spotsMessage({ spots: 30, spotsLeft: 30 })).toBe('30 spots open');
    expect(spotsMessage({ spots: 30, spotsLeft: 20 })).toBe('20 of 30 spots left');
    expect(spotsMessage({ spots: 30, spotsLeft: 4 })).toBe('Only 4 spots left!');
    expect(spotsMessage({ spots: 30, spotsLeft: 1 })).toBe('Last spot!');
    expect(spotsMessage({ spots: 30, spotsLeft: 0 })).toBe('Fully booked');
  });

  it('formats date ranges the same on the server and the phone', () => {
    expect(dateRange('2026-10-30T00:00:00.000Z', '2026-11-01T00:00:00.000Z')).toBe('Oct 30 – Nov 1');
    expect(dateRange('2026-12-05', '2026-12-07')).toBe('Dec 5 – 7');
    expect(dateRange(null, null)).toBe('Dates to be announced');
    expect(tripNights('2026-10-30', '2026-11-01')).toBe(2);
  });

  it('counts down to departure in whole days', () => {
    const now = new Date('2026-10-05T18:00:00Z');
    expect(countdown('2026-10-30T00:00:00Z', now)).toBe('Leaves in 25 days');
    expect(countdown('2026-10-06', now)).toBe('Leaves tomorrow');
    expect(countdown('2026-10-05', now)).toBe('Leaving today');
    expect(countdown('2026-10-01', now)).toBeNull();
  });

  it('works out what is due now for a deposit or the full price', () => {
    expect(dueNow({ price: 150, depositAmount: 50 }, 2, 'deposit')).toBe(100);
    expect(dueNow({ price: 150, depositAmount: 50 }, 2, 'full')).toBe(300);
    expect(dueNow({ price: 150, depositAmount: null }, 3, 'deposit')).toBe(450);
  });

  it('links Liberian numbers to WhatsApp', () => {
    expect(whatsappLink('0886 555 101')).toBe('https://wa.me/231886555101');
    expect(whatsappLink('+231 777 555 202', 'Hi')).toBe('https://wa.me/231777555202?text=Hi');
  });

  it('picks a friendly icon for what is included', () => {
    expect(itemIcon('Transportation')).toBe('🚌');
    expect(itemIcon('Breakfast & dinner')).toBe('🍽️');
    expect(itemIcon('Buchanan port tour')).toBe('⚓');
    expect(itemIcon('Something else', '✓')).toBe('✓');
  });

  it('walks a paid booking from booked to trip day', () => {
    const trip = { status: 'upcoming' } as never;
    const states = (paymentStatus: string, status: string) =>
      bookingSteps({ status, paymentStatus, trip } as never).map((s) => `${s.label}:${s.state}`);
    expect(states('unpaid', 'pending')).toEqual(['Booked:done', 'Paid:current', 'Confirmed:upcoming', 'Trip day:upcoming']);
    expect(states('part_paid', 'confirmed')).toEqual(['Booked:done', 'Deposit in:done', 'Confirmed:done', 'Trip day:current']);
    expect(states('free', 'confirmed')).toEqual(['Booked:done', 'Confirmed:done', 'Trip day:current']);
  });
});
