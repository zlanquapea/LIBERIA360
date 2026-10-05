import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BookConsultation } from './BookConsultation';
import { getConsultDoctor, requestConsultation } from '@/lib/consultations-api';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'patient-1', name: 'Comfort Doe' }, ready: true }),
}));
jest.mock('@/components/BrandLoader', () => ({ BrandLoader: () => <p>Loading</p> }));
jest.mock('@/lib/consultations-api', () => ({
  getConsultDoctor: jest.fn(),
  requestConsultation: jest.fn(),
}));

const doctor = {
  id: 'doc-1',
  fullName: 'Musu Kollie',
  specialty: 'Family medicine',
  licenceNumber: 'LMDC-1',
  bio: null,
  photoUrl: null,
  verified: true,
  fee: 500,
  availableNow: true,
  clinic: { id: 'clinic-1', name: 'Hope Family Clinic', slug: 'hope', location: 'Monrovia' },
  paymentMethods: [{ method: 'mtn_momo', label: 'MTN MoMo', account: '0886 555 010' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  (getConsultDoctor as jest.Mock).mockResolvedValue(doctor);
});

describe('BookConsultation', () => {
  it('sends anyone with an emergency sign to emergency care instead of booking', async () => {
    render(<BookConsultation doctorId="doc-1" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Struggling to breathe' }));
    expect(screen.queryByRole('button', { name: /None of these/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Get emergency care now' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Find a hospital near me/ })).toHaveAttribute('href', '/near-me');
    expect(requestConsultation).not.toHaveBeenCalled();
  });

  it('books with the details and the mobile money transaction, then opens the consultation', async () => {
    (requestConsultation as jest.Mock).mockResolvedValue({ id: 'c-1' });
    render(<BookConsultation doctorId="doc-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /None of these/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/a little more/);
    fireEvent.change(screen.getByPlaceholderText(/Fever every night/), {
      target: { value: 'Cough for a week and fever at night' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 3 days'), { target: { value: '1 week' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));

    expect(screen.getByText('0886 555 010')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/MP240115/), { target: { value: 'MP555.1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start consultation' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/account/consultations/c-1'));
    expect(requestConsultation).toHaveBeenCalledWith({
      doctorId: 'doc-1',
      patientName: undefined,
      patientAge: undefined,
      reason: 'Cough for a week and fever at night',
      symptomsSince: '1 week',
      redFlags: [],
      noRedFlagsConfirmed: true,
      paymentMethod: 'mtn_momo',
      paymentReference: 'MP555.1',
    });
  });
});
