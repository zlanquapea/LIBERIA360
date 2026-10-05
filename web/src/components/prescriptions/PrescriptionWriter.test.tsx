import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PrescriptionWriter } from './PrescriptionWriter';
import { codeFromScan } from './RxScanner';
import { issuePrescription, lookupPatient, searchClinicCatalog, type MyClinic } from '@/lib/clinic-api';

jest.mock('@/lib/clinic-api', () => ({
  issuePrescription: jest.fn(),
  lookupPatient: jest.fn(),
  searchClinicCatalog: jest.fn(),
}));

const issue = issuePrescription as jest.Mock;
const lookup = lookupPatient as jest.Mock;
const search = searchClinicCatalog as jest.Mock;

const clinic: MyClinic = {
  id: 'clinic-1',
  name: 'Hope Family Clinic',
  slug: 'hope',
  address: 'Sinkor',
  location: 'Monrovia',
  telephone: '0777',
  about: null,
  logoUrl: null,
  coverUrl: null,
  licenceNumber: 'MOH-1',
  status: 'approved',
  statusNotes: null,
  pharmacyId: 'ph-1',
  pharmacy: { id: 'ph-1', name: 'CarePoint', slug: 'carepoint', address: '', location: '', telephone: '', approved: true },
  myRole: 'doctor',
  canPrescribe: true,
  mtnMomoNumber: null,
  orangeMoneyNumber: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('PrescriptionWriter', () => {
  it('finds the patient, picks from the pharmacy shelf, fills the course and sends it to the pharmacy', async () => {
    lookup.mockResolvedValue({ id: 'patient-1', name: 'Comfort Doe' });
    search.mockResolvedValue([{ id: 'prod-1', name: 'Amoxicillin 500mg capsules', price: 450, stock: 40, prescriptionRequired: true }]);
    issue.mockResolvedValue({
      id: 'rx-1', code: 'ABCD-2345', status: 'sent', expired: false, issuedAt: new Date().toISOString(), expiresAt: new Date().toISOString(),
      dispensedAt: null, clinic: null, doctor: null, pharmacy: { name: 'CarePoint' }, pharmacyOrderId: null, patientName: 'Comfort Doe',
      patientAge: null, patientPhone: null, hasPatientAccount: true, notesForPharmacist: null, cancelledReason: null, itemCount: 1, items: [], full: true,
    });
    render(<PrescriptionWriter clinic={clinic} />);

    fireEvent.change(screen.getByPlaceholderText(/0886 123 456/), { target: { value: 'comfort@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find' }));
    expect(await screen.findByText(/Comfort Doe has an account/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search the pharmacy shelf/), { target: { value: 'amox' } });
    fireEvent.click(await screen.findByRole('button', { name: /Amoxicillin 500mg capsules/ }, { timeout: 2000 }));
    expect(screen.getByText(/40 in stock/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('1 tablet 3 times a day'), { target: { value: '1 capsule 3 times a day' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Days' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Full course: 21' }));
    expect(screen.getByRole('checkbox', { name: /Send to CarePoint now/ })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Issue prescription' }));
    await waitFor(() => expect(issue).toHaveBeenCalled());
    expect(issue.mock.calls[0]).toEqual([
      'clinic-1',
      expect.objectContaining({
        patientUserId: 'patient-1',
        patientName: 'Comfort Doe',
        sendToPharmacy: true,
        items: [expect.objectContaining({ medicine: 'Amoxicillin 500mg capsules', quantity: 21, durationDays: 7, productId: 'prod-1' })],
      }),
    ]);
    expect(await screen.findByText(/Sent to CarePoint/)).toBeInTheDocument();
  });

  it("won't drop a medicine row that has a dose but no name", async () => {
    render(<PrescriptionWriter clinic={clinic} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Full name' }), { target: { value: 'Comfort Doe' } });
    fireEvent.change(screen.getByPlaceholderText('1 tablet 3 times a day'), { target: { value: '1 tablet once a day' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Issue prescription' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Add the name of medicine 1');
    expect(issue).not.toHaveBeenCalled();
  });

  it('writes for the consultation patient without looking anyone up', async () => {
    issue.mockResolvedValue({
      id: 'rx-2', code: 'WXYZ-2345', status: 'issued', expired: false, issuedAt: new Date().toISOString(), expiresAt: new Date().toISOString(),
      dispensedAt: null, clinic: null, doctor: null, pharmacy: null, pharmacyOrderId: null, patientName: 'Comfort Doe',
      patientAge: 34, patientPhone: null, hasPatientAccount: true, notesForPharmacist: null, cancelledReason: null, itemCount: 1, items: [], full: true,
    });
    render(<PrescriptionWriter clinic={clinic} consultation={{ id: 'c-1', patientName: 'Comfort Doe', patientAge: 34 }} />);
    expect(screen.queryByPlaceholderText(/0886 123 456/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Full name' })).toHaveValue('Comfort Doe');
    fireEvent.change(screen.getByPlaceholderText(/Search the pharmacy shelf/), { target: { value: 'Paracetamol 500mg' } });
    fireEvent.change(screen.getByPlaceholderText('1 tablet 3 times a day'), { target: { value: '2 tablets 3 times a day' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity' }), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue prescription' }));
    await waitFor(() => expect(issue).toHaveBeenCalled());
    expect(issue.mock.calls[0][1]).toEqual(
      expect.objectContaining({ consultationId: 'c-1', patientUserId: undefined, patientName: 'Comfort Doe', patientAge: 34 }),
    );
  });
});

describe('codeFromScan', () => {
  it('reads the code from the QR link or typed text', () => {
    expect(codeFromScan('https://liberia360.com/rx/KPZELJ57?t=abc')).toBe('KPZELJ57');
    expect(codeFromScan('kpze-lj57')).toBe('KPZELJ57');
  });
});
