import { canChoosePharmacy, rxSteps, suggestedQuantity } from './prescriptions';

describe('prescriptions', () => {
  it('works out the course quantity from the dosage', () => {
    expect(suggestedQuantity('1 capsule 3 times a day', 7)).toBe(21);
    expect(suggestedQuantity('2 tablets twice a day', 3)).toBe(12);
    expect(suggestedQuantity('1 tablet once a day', 30)).toBe(30);
    expect(suggestedQuantity('5 ml 3 times a day', 5)).toBeNull();
    expect(suggestedQuantity('1 tablet 3 times a day', undefined)).toBeNull();
  });

  it('tracks a counter prescription', () => {
    const steps = rxSteps({ status: 'ready', pharmacy: { name: 'CarePoint' } as never });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'current', 'upcoming']);
    expect(steps[1].label).toBe('Sent to CarePoint');
    expect(rxSteps({ status: 'dispensed', pharmacy: null }).every((s) => s.state === 'done')).toBe(true);
  });

  it('lets the patient choose a pharmacy only while nobody is preparing it', () => {
    expect(canChoosePharmacy({ status: 'issued', expired: false })).toBe(true);
    expect(canChoosePharmacy({ status: 'sent', expired: false })).toBe(true);
    expect(canChoosePharmacy({ status: 'preparing', expired: false })).toBe(false);
    expect(canChoosePharmacy({ status: 'issued', expired: true })).toBe(false);
  });
});
