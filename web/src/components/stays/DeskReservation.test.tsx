import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeskReservation } from './DeskReservation';
import { checkInGuest, getReservation, verifyStayPayment, type Reservation } from '@/lib/stays-api';
import { todayInLiberia } from '@/lib/stays';

jest.mock('@/components/BrandLoader', () => ({ BrandLoader: () => <p>Loading</p> }));
jest.mock('./StayChat', () => ({ StayChat: () => <div>chat</div> }));
jest.mock('@/lib/stays-api', () => ({
  getReservation: jest.fn(),
  verifyStayPayment: jest.fn(),
  checkInGuest: jest.fn(),
  checkOutGuest: jest.fn(),
  markNoShow: jest.fn(),
  markStayRefunded: jest.fn(),
  respondToReservation: jest.fn(),
}));

const today = todayInLiberia();
const base: Reservation = {
  id: 'res-1',
  code: 'K7Q2MP',
  source: 'online',
  status: 'requested',
  checkIn: today,
  checkOut: '2099-01-01',
  nights: 2,
  rooms: 1,
  adults: 2,
  children: 0,
  guestName: 'Comfort Doe',
  guestPhone: '0886 123 456',
  arrivalTime: 'Around 6pm',
  specialRequests: null,
  roomTypeId: 'std',
  roomName: 'Standard double',
  roomImage: null,
  pricePerNight: 55,
  totalAmount: 110,
  currency: 'USD',
  paymentMethod: 'mtn_momo',
  paymentStatus: 'awaiting_verification',
  paymentReference: 'MP777.1',
  paymentAccount: '0886 444 222',
  propertyNote: null,
  roomNumbers: null,
  confirmedAt: null,
  checkedInAt: null,
  checkedOutAt: null,
  cancelledAt: null,
  createdAt: new Date().toISOString(),
  property: { id: 'biz-1', name: 'Mamba Point Lodge', slug: 'mamba', phone: null, whatsapp: null, image: null, address: null, latitude: null, longitude: null },
  viewerRole: 'property',
  unreadMessages: 0,
};

beforeEach(() => jest.clearAllMocks());

describe('DeskReservation', () => {
  it('puts the mobile money check first, and confirming it confirms the booking', async () => {
    (getReservation as jest.Mock).mockResolvedValue(base);
    (verifyStayPayment as jest.Mock).mockResolvedValue({ ...base, status: 'confirmed', paymentStatus: 'paid' });
    render(<DeskReservation businessId="biz-1" id="res-1" />);
    expect(await screen.findByText('MP777.1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm booking' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Payment received, confirm' }));
    await waitFor(() => expect(verifyStayPayment).toHaveBeenCalledWith('res-1', true));
    expect(await screen.findByRole('button', { name: 'Check in' })).toBeInTheDocument();
  });

  it('checks the guest in with their room number', async () => {
    (getReservation as jest.Mock).mockResolvedValue({ ...base, status: 'confirmed', paymentStatus: 'paid' });
    (checkInGuest as jest.Mock).mockResolvedValue({ ...base, status: 'checked_in', paymentStatus: 'paid', roomNumbers: '12' });
    render(<DeskReservation businessId="biz-1" id="res-1" />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Room number' }), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    await waitFor(() => expect(checkInGuest).toHaveBeenCalledWith('res-1', '12'));
    expect(await screen.findByRole('button', { name: 'Check out' })).toBeInTheDocument();
  });
});
