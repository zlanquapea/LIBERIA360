import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StayBooking } from './StayBooking';
import { getStayAvailability, reserveRoom, type PublicStay } from '@/lib/stays-api';
import { addDays, todayInLiberia } from '@/lib/stays';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'guest-1', name: 'Comfort Doe', phone: '0886 123 456' }, ready: true }),
}));
jest.mock('@/lib/stays-api', () => ({
  getStayAvailability: jest.fn(),
  reserveRoom: jest.fn(),
}));

const checkIn = addDays(todayInLiberia(), 2);
const checkOut = addDays(checkIn, 2);

const stay: PublicStay = {
  currency: 'USD',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  instantConfirm: false,
  cancellationPolicy: 'Free cancellation up to 24 hours before arrival.',
  houseRules: null,
  mobileMoneyAccountName: 'Mamba Point Lodge',
  paymentOptions: [
    { method: 'pay_at_property', label: 'Pay at the front desk', account: null },
    { method: 'mtn_momo', label: 'MTN MoMo', account: '0886 444 222' },
  ],
  roomTypes: [
    { id: 'std', name: 'Standard double', description: null, images: [], maxGuests: 2, bedSummary: '1 double bed', pricePerNight: 55, amenities: ['Wi-Fi'] },
    { id: 'suite', name: 'Family suite', description: null, images: [], maxGuests: 4, bedSummary: null, pricePerNight: 140, amenities: [] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  (getStayAvailability as jest.Mock).mockResolvedValue({
    checkIn,
    checkOut,
    nights: 2,
    rooms: [
      { roomTypeId: 'std', roomsLeft: 2, total: 110 },
      { roomTypeId: 'suite', roomsLeft: 0, total: 280 },
    ],
  });
});

function renderBooking() {
  return render(
    <StayBooking business={{ id: 'biz-1', name: 'Mamba Point Lodge', slug: 'mamba' }} stay={stay} initialCheckIn={checkIn} initialCheckOut={checkOut} />,
  );
}

describe('StayBooking', () => {
  it('shows live availability with the real price for the stay', async () => {
    renderBooking();
    const suite = (await screen.findByText('Sold out')).closest('article')!;
    expect(within(suite).queryByRole('button', { name: 'Reserve' })).not.toBeInTheDocument();
    const standard = screen.getByText('Standard double').closest('article')!;
    expect(within(standard).getByText('Only 2 left')).toBeInTheDocument();
    expect(within(standard).getByText(/US\$110\.00 for 2 nights/)).toBeInTheDocument();
    expect(getStayAvailability).toHaveBeenCalledWith('biz-1', checkIn, checkOut);
  });

  it('books with mobile money and opens the stay', async () => {
    (reserveRoom as jest.Mock).mockResolvedValue({ id: 'res-1' });
    renderBooking();
    const standard = (await screen.findByText('Only 2 left')).closest('article')!;
    fireEvent.click(within(standard).getByRole('button', { name: 'Reserve' }));

    expect(await screen.findByDisplayValue('Comfort Doe')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /MTN MoMo/ }));
    expect(screen.getByText('0886 444 222')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Submit payment & book/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/transaction ID/);

    fireEvent.change(screen.getByPlaceholderText(/MP240115/), { target: { value: 'MP777.1' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit payment & book/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/account/stays/res-1'));
    expect(reserveRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        roomTypeId: 'std',
        checkIn,
        checkOut,
        rooms: 1,
        adults: 2,
        children: 0,
        guestName: 'Comfort Doe',
        guestPhone: '0886 123 456',
        paymentMethod: 'mtn_momo',
        paymentReference: 'MP777.1',
      }),
    );
  });

  it('asks for more rooms when the party is too big for one', async () => {
    renderBooking();
    await screen.findByText('Only 2 left');
    fireEvent.click(screen.getByRole('button', { name: 'More adults' }));
    const standard = screen.getByText('Standard double').closest('article')!;
    // Three guests need two standard rooms, which is picked for them.
    expect(within(standard).getByRole('combobox')).toHaveValue('2');
    expect(within(standard).getByRole('button', { name: 'Reserve' })).toBeEnabled();
  });
});
