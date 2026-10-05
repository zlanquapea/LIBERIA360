import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BookSpotSheet } from './BookSpotSheet';
import { bookTrip } from '@/lib/group-trips-api';
import type { TripHosting } from '@/lib/types';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-1', name: 'Musu Kollie', phone: '0886 123 456' }, ready: true }),
}));
jest.mock('@/lib/group-trips-api', () => ({ bookTrip: jest.fn() }));

const hosting = {
  open: true,
  tagline: 'Law. Culture. Connection.',
  price: 150,
  currency: 'USD',
  isFree: false,
  depositAmount: 50,
  balanceDueDate: '2026-10-25',
  bookingDeadline: null,
  spots: 30,
  spotsBooked: 2,
  spotsHeld: 0,
  spotsLeft: 28,
  waitlisted: 0,
  maxPerBooking: 4,
  requireApproval: false,
  includes: [],
  excludes: [],
  activities: [],
  meetingPoint: null,
  departureTime: null,
  organisers: [],
  gallery: [],
  goodToKnow: null,
  contactPhone: null,
  cashEnabled: true,
  mtnMomoNumber: '0886 555 101',
  orangeMoneyNumber: null,
  accountName: 'Tuzee Tours',
  paymentOptions: [
    { method: 'cash', account: null },
    { method: 'mtn_momo', account: '0886 555 101' },
  ],
} as TripHosting;

beforeEach(() => {
  jest.clearAllMocks();
  (bookTrip as jest.Mock).mockResolvedValue({ id: 'b-1' });
});

describe('BookSpotSheet', () => {
  it('books two spots with a MoMo deposit and opens the ticket', async () => {
    render(<BookSpotSheet open onClose={() => undefined} tripId="trip-1" tripTitle="The Buchanan Escape" hosting={hosting} />);
    fireEvent.click(screen.getByRole('button', { name: 'One spot more' }));
    fireEvent.change(screen.getByPlaceholderText('Name as on their ID'), { target: { value: 'Kollie Doe' } });
    expect(screen.getByText(/Pay the deposit · US\$100/)).toBeInTheDocument();
    expect(screen.getByText(/Then US\$200 by Sun 25 Oct/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /MTN MoMo/ }));
    expect(screen.getByText('0886 555 101')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Book 2 spots · US\$100 now/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('transaction ID');
    fireEvent.change(screen.getByPlaceholderText(/MP240115/), { target: { value: 'MP261005.1422' } });
    fireEvent.click(screen.getByRole('button', { name: /Book 2 spots · US\$100 now/ }));
    await waitFor(() =>
      expect(bookTrip).toHaveBeenCalledWith('trip-1', {
        seats: 2,
        travellers: ['Musu Kollie', 'Kollie Doe'],
        contactName: 'Musu Kollie',
        phone: '0886 123 456',
        notes: undefined,
        paymentPlan: 'deposit',
        paymentMethod: 'mtn_momo',
        paymentReference: 'MP261005.1422',
      }),
    );
    expect(push).toHaveBeenCalledWith('/account/trip-bookings/b-1');
  });

  it('puts people on the waitlist with nothing to pay when the trip is full', async () => {
    render(
      <BookSpotSheet open onClose={() => undefined} tripId="trip-1" tripTitle="The Buchanan Escape" hosting={{ ...hosting, spotsLeft: 0 }} />,
    );
    expect(screen.queryByText('How you’ll pay')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /MTN MoMo/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Join the waitlist · 1 spot/ }));
    await waitFor(() => expect(bookTrip).toHaveBeenCalledWith('trip-1', expect.objectContaining({ seats: 1, joinWaitlist: true })));
    expect((bookTrip as jest.Mock).mock.calls[0][1].paymentMethod).toBeUndefined();
  });

  it('books a free trip without asking about money', async () => {
    render(
      <BookSpotSheet
        open
        onClose={() => undefined}
        tripId="trip-1"
        tripTitle="Beach clean-up day"
        hosting={{ ...hosting, isFree: true, price: 0, depositAmount: null }}
      />,
    );
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Book 1 spot · Free/ }));
    await waitFor(() => expect(bookTrip).toHaveBeenCalledWith('trip-1', expect.objectContaining({ seats: 1, travellers: ['Musu Kollie'] })));
  });
});
