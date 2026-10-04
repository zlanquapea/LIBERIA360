import {
  acceptedPaymentMethods,
  cartTotals,
  checkoutProblem,
  loadCart,
  pharmacyOpeningPeriods,
  saveCart,
  trackerSteps,
} from './pharmacy-ordering';
import type { PharmacyProduct } from './pharmacy-api';

const product = (id: string, price: number, rx = false): PharmacyProduct => ({
  id, pharmacyId: 'p', categoryId: 'c', name: id, imageUrl: null, price, prescriptionRequired: rx, isVisible: true, inventory: { quantity: 9 },
});

describe('pharmacy ordering', () => {
  it('lists the payment methods a pharmacy takes', () => {
    expect(acceptedPaymentMethods({ mtnMomoNumber: '0886', orangeMoneyNumber: ' ' })).toEqual(['cash', 'mtn_momo']);
    expect(acceptedPaymentMethods({ acceptsCash: false, orangeMoneyNumber: '0777' })).toEqual(['orange_money']);
  });

  it('totals a cart and spots prescription items', () => {
    const t = cartTotals({ a: 2, b: 1 }, [product('a', 10), product('b', 5, true)], 'delivery', 150);
    expect(t).toEqual({ count: 3, subtotal: 25, delivery: 150, total: 175, needsPrescription: true });
  });

  it('turns pharmacy hours into opening periods', () => {
    expect(
      pharmacyOpeningPeriods([
        { dayOfWeek: 1, opensAt: '08:00:00', closesAt: '20:00:00', isClosed: false },
        { dayOfWeek: 0, opensAt: null, closesAt: null, isClosed: true },
      ]),
    ).toEqual([{ dayOfWeek: 1, opens: '08:00', closes: '20:00' }]);
    expect(pharmacyOpeningPeriods([])).toBeNull();
  });

  it('explains what is missing before checkout', () => {
    const base = { fulfillment: 'pickup' as const, address: '', phone: '', paymentMethod: 'cash' as const, paymentReference: '', needsPrescription: false, prescriptionFile: null, consent: false };
    expect(checkoutProblem(base)).toBeNull();
    expect(checkoutProblem({ ...base, paymentMethod: 'orange_money' })).toMatch(/Orange Money transaction ID/);
    expect(checkoutProblem({ ...base, paymentMethod: 'orange_money', needsPrescription: true, prescriptionFile: new File(['x'], 'a.jpg'), consent: true })).toBeNull();
    expect(checkoutProblem({ ...base, fulfillment: 'delivery', address: 'Sinkor 15th St', phone: '12' })).toMatch(/phone/);
  });

  it('shows prescription and payment steps only when they apply', () => {
    const cash = trackerSteps({ status: 'preparing', fulfillmentMethod: 'pickup', paymentMethod: 'cash', paymentStatus: 'pay_on_collection', prescriptionId: null });
    expect(cash.map((s) => s.key)).toEqual(['placed', 'accepted', 'preparing', 'handover', 'completed']);
    expect(cash.find((s) => s.key === 'handover')?.state).toBe('current');

    const rxMomo = trackerSteps({ status: 'accepted', fulfillmentMethod: 'delivery', paymentMethod: 'mtn_momo', paymentStatus: 'awaiting_payment', prescriptionId: 'rx' });
    expect(rxMomo.map((s) => [s.key, s.state])).toEqual([
      ['placed', 'done'],
      ['rx', 'done'],
      ['payment', 'current'],
      ['preparing', 'upcoming'],
      ['handover', 'upcoming'],
      ['completed', 'upcoming'],
    ]);
  });

  it('saves and restores a cart per pharmacy', () => {
    saveCart('ph-1', { a: 2, b: 0 });
    expect(loadCart('ph-1')).toEqual({ a: 2 });
    saveCart('ph-1', {});
    expect(loadCart('ph-1')).toEqual({});
  });
});
