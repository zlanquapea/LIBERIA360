import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TripDeskBoard } from './TripDeskBoard';
import { boardTripBooking, getTripDesk, reviewTripPayment } from '@/lib/group-trips-api';

jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'host-1' }, token: 't', ready: true }) }));
jest.mock('@/components/prescriptions/RxScanner', () => ({ RxScanner: () => null }));
jest.mock('@/lib/group-trips-api', () => ({
  getTripDesk: jest.fn(),
  reviewTripPayment: jest.fn(),
  boardTripBooking: jest.fn(),
  saveTripHosting: jest.fn(),
}));

const trip = { id: 'trip-1', title: 'The Buchanan Escape', startDate: '2026-10-30T00:00:00Z', endDate: '2026-11-01T00:00:00Z', coverImage: null, destination: null, status: 'upcoming' };
const booking = (o: Record<string, unknown>) => ({
  id: 'b-1',
  code: 'HEFCN3',
  status: 'pending',
  seats: 2,
  travellers: [
    { name: 'Musu Kollie', boarded: false },
    { name: 'Kollie Doe', boarded: false },
  ],
  contactName: 'Musu Kollie',
  phone: '0886 123 456',
  notes: null,
  totalAmount: 300,
  currency: 'USD',
  amountPaid: 0,
  outstanding: 300,
  paymentStatus: 'unpaid',
  payments: [],
  trip,
  ...o,
});

function desk(bookings: unknown[]) {
  return {
    trip,
    hosting: { spots: 30, spotsLeft: 26, isFree: false, currency: 'USD', open: true, price: 150 },
    stats: { travellers: 2, boarded: 0, collected: 100, expected: 600, outstanding: 500, paymentsToCheck: 1, refundsDue: 0 },
    bookings,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('TripDeskBoard', () => {
  it('puts payments to check first and lets the organiser mark one received', async () => {
    (getTripDesk as jest.Mock).mockResolvedValue(
      desk([
        booking({
          payments: [{ id: 'p-1', amount: 100, method: 'mtn_momo', reference: 'MP1', account: '0886 555 101', status: 'awaiting_verification', recordedByHost: false }],
        }),
        booking({ id: 'b-2', code: 'K7Q2MP', contactName: 'Comfort Doe', status: 'confirmed', amountPaid: 300, outstanding: 0, paymentStatus: 'paid', travellers: [{ name: 'Comfort Doe', boarded: false }], seats: 1 }),
      ]),
    );
    (reviewTripPayment as jest.Mock).mockResolvedValue({});
    render(<TripDeskBoard tripId="trip-1" focusBooking="b-1" />);
    const check = (await screen.findByText('Payments to check · 1')).closest('section')!;
    expect(within(check).getAllByText('Musu Kollie').length).toBeGreaterThan(0);
    expect(screen.getByText('Going · 1')).toBeInTheDocument();
    expect(screen.getByText('4/30')).toBeInTheDocument();
    fireEvent.click(within(check).getByRole('button', { name: 'Received' }));
    await waitFor(() => expect(reviewTripPayment).toHaveBeenCalledWith('b-1', 'p-1', true));
    expect(getTripDesk).toHaveBeenCalledTimes(2);
  });

  it('finds a ticket by its QR text on the roll call and boards everyone on it', async () => {
    (getTripDesk as jest.Mock).mockResolvedValue(desk([booking({ status: 'confirmed', amountPaid: 300, outstanding: 0, paymentStatus: 'paid' })]));
    (boardTripBooking as jest.Mock).mockResolvedValue({});
    render(<TripDeskBoard tripId="trip-1" />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Roll call' }));
    expect(screen.getByText(/of 2 on board/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Booking code'), { target: { value: 'LIB360-TRIP:hefcn3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find' }));
    fireEvent.click(await screen.findByRole('button', { name: /Board all 2/ }));
    await waitFor(() => expect(boardTripBooking).toHaveBeenCalledWith('b-1', { boarded: true, traveller: undefined }));
  });
});
