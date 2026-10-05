import { clock, consultSteps, RED_FLAGS } from './consultations';

describe('consultations', () => {
  it('tracks a consultation on the shared stepper', () => {
    expect(consultSteps({ status: 'requested', paymentStatus: 'awaiting_verification' }).map((s) => s.state)).toEqual([
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(consultSteps({ status: 'active', paymentStatus: 'paid' }).map((s) => s.state)).toEqual([
      'done',
      'done',
      'current',
      'upcoming',
    ]);
    expect(consultSteps({ status: 'completed', paymentStatus: 'paid' }).every((s) => s.state === 'done')).toBe(true);
  });

  it('formats voice note lengths', () => {
    expect(clock(5)).toBe('0:05');
    expect(clock(125)).toBe('2:05');
  });

  it('keeps the emergency signs the API refuses', () => {
    expect(RED_FLAGS.map((f) => f.key)).toEqual(
      expect.arrayContaining(['chest_pain', 'breathing', 'bleeding', 'seizure', 'baby_fever', 'self_harm']),
    );
  });
});
