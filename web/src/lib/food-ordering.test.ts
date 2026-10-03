import {
  acceptedPaymentMethods,
  checkoutError,
  checkoutTotals,
  defaultMenuSettings,
  deliveryFeeShort,
  describeDeliveryFee,
  initialCheckout,
  nextOwnerSteps,
  paymentStatusLabel,
  trackerIndex,
  type CheckoutState,
} from './food-ordering';
import type { MenuSettings } from './types';

const settings: MenuSettings = {
  ...defaultMenuSettings('b1'),
  deliveryEnabled: true,
  deliveryFee: 2,
  freeDeliveryMinimum: 25,
  orangeMoneyNumber: '0777 123 456',
};

describe('food-ordering', () => {
  it('describes free, flat and free-over delivery fees', () => {
    expect(describeDeliveryFee({ ...settings, deliveryFee: 0 })).toBe('Free delivery');
    expect(describeDeliveryFee({ ...settings, freeDeliveryMinimum: null })).toBe('Delivery US$2.00');
    expect(describeDeliveryFee(settings)).toBe('Delivery US$2.00 · free over US$25.00');
    expect(describeDeliveryFee({ ...settings, currency: 'LRD', deliveryFee: 300, freeDeliveryMinimum: null })).toBe(
      'Delivery L$300',
    );
  });

  it('adds the delivery fee only for delivery, waived over the minimum', () => {
    expect(checkoutTotals(settings, 'pickup', 10)).toEqual({ deliveryFee: 0, total: 10 });
    expect(checkoutTotals(settings, 'delivery', 10)).toEqual({ deliveryFee: 2, total: 12 });
    expect(checkoutTotals(settings, 'delivery', 25)).toEqual({ deliveryFee: 0, total: 25 });
  });

  it('lists mobile money methods only when a number is set', () => {
    expect(acceptedPaymentMethods(settings)).toEqual(['orange_money', 'cash']);
    expect(acceptedPaymentMethods({ ...settings, cashEnabled: false, mtnMomoNumber: '0886' })).toEqual([
      'mtn_momo',
      'orange_money',
    ]);
  });

  it('starts checkout on delivery and cash when offered, keeping a saved contact', () => {
    expect(initialCheckout(settings, { contactPhone: '0886 555 000' })).toEqual({
      fulfillment: 'delivery',
      deliveryAddress: '',
      contactPhone: '0886 555 000',
      paymentMethod: 'cash',
      paymentReference: '',
    });
    expect(initialCheckout({ ...settings, deliveryEnabled: false, cashEnabled: false })).toEqual(
      expect.objectContaining({ fulfillment: 'pickup', paymentMethod: 'orange_money' }),
    );
  });

  it('validates checkout the way the API does', () => {
    const base: CheckoutState = {
      fulfillment: 'delivery',
      deliveryAddress: '12 Tubman Blvd',
      contactPhone: '0886 555 000',
      paymentMethod: 'cash',
      paymentReference: '',
    };
    expect(checkoutError(base)).toBeNull();
    expect(checkoutError({ ...base, deliveryAddress: ' ' })).toBe('Add the address to deliver to');
    expect(checkoutError({ ...base, contactPhone: '' })).toBe('Add a phone number so the rider can reach you');
    expect(checkoutError({ ...base, contactPhone: 'call me' })).toBe('Check the phone number');
    expect(checkoutError({ ...base, fulfillment: 'pickup', deliveryAddress: '', contactPhone: '' })).toBeNull();
    expect(checkoutError({ ...base, paymentMethod: 'mtn_momo' })).toBe('Enter the MTN MoMo transaction ID');
  });

  it('places an order on the tracker and offers the owner the next steps', () => {
    expect(trackerIndex({ status: 'pending', fulfillment: 'pickup' })).toBe(0);
    expect(trackerIndex({ status: 'ready', fulfillment: 'pickup' })).toBe(3);
    expect(trackerIndex({ status: 'out_for_delivery', fulfillment: 'delivery' })).toBe(3);
    expect(trackerIndex({ status: 'declined', fulfillment: 'delivery' })).toBe(-1);

    expect(nextOwnerSteps({ status: 'confirmed', fulfillment: 'delivery' }).map((s) => s.status)).toEqual([
      'preparing',
      'out_for_delivery',
    ]);
    expect(nextOwnerSteps({ status: 'preparing', fulfillment: 'pickup' }).map((s) => s.status)).toEqual([
      'ready',
      'completed',
    ]);
    expect(nextOwnerSteps({ status: 'pending', fulfillment: 'pickup' })).toEqual([]);
  });

  it('words cash payment status by how the food arrives', () => {
    expect(paymentStatusLabel({ paymentStatus: 'pay_on_delivery', fulfillment: 'pickup' })).toBe('Pay at pickup');
    expect(paymentStatusLabel({ paymentStatus: 'pay_on_delivery', fulfillment: 'delivery' })).toBe('Pay on delivery');
  });
});

describe('deliveryFeeShort', () => {
  it('drops the "Delivery" prefix for use under a Delivery heading', () => {
    expect(deliveryFeeShort({ ...defaultMenuSettings('b1'), deliveryFee: 0 })).toBe('Free');
    expect(deliveryFeeShort({ ...defaultMenuSettings('b1'), deliveryFee: 2, freeDeliveryMinimum: 25 })).toBe(
      'US$2.00 · free over US$25.00',
    );
  });
});
