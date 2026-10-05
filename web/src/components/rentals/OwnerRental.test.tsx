import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OwnerRental } from './OwnerRental';
import { getRental, handOverCar, returnCar, type Rental } from '@/lib/rentals-api';
import { todayInLiberia } from '@/lib/stays';

jest.mock('@/components/BrandLoader', () => ({ BrandLoader: () => <p>Loading</p> }));
jest.mock('@/components/stays/StayChat', () => ({ ThreadChat: () => <div>chat</div> }));
jest.mock('@/lib/rentals-api', () => ({
  getRental: jest.fn(),
  getRentalMessages: jest.fn(),
  sendRentalMessage: jest.fn(),
  handOverCar: jest.fn(),
  returnCar: jest.fn(),
  markRentalNoShow: jest.fn(),
  markRentalRefunded: jest.fn(),
  respondToRental: jest.fn(),
  verifyRentalPayment: jest.fn(),
}));

const today = todayInLiberia();
const base = {
  id: 'r-1',
  code: 'K7Q2MP',
  status: 'confirmed',
  rentalUnit: 'day',
  pickupDate: today,
  returnDate: '2099-01-03',
  pickupTime: '09:00',
  returnTime: '17:00',
  units: 2,
  dueBackAt: '2099-01-03T17:00:00Z',
  overdue: false,
  withDriver: false,
  additionalDriver: false,
  delivery: false,
  deliveryAddress: null,
  renterName: 'Comfort Doe',
  renterPhone: '0886 123 456',
  licenceNumber: 'LR-778899',
  notes: null,
  carListingId: 'car-1',
  carTitle: 'Toyota RAV4 2021',
  carImage: null,
  pickupLocation: 'Sinkor',
  unitPrice: 60,
  baseAmount: 120,
  driverFee: 0,
  additionalDriverFee: 0,
  deliveryFee: 0,
  totalAmount: 120,
  depositAmount: 200,
  mileageLimitPerDay: 100,
  excessMileageFee: 0.5,
  currency: 'USD',
  paymentMethod: 'cash_at_pickup',
  paymentStatus: 'pay_at_pickup',
  paymentReference: null,
  paymentAccount: null,
  ownerNote: null,
  pickedUpAt: null,
  pickupOdometer: null,
  pickupFuel: null,
  pickupNotes: null,
  licenceChecked: false,
  depositCollected: null,
  returnedAt: null,
  returnOdometer: null,
  returnFuel: null,
  returnNotes: null,
  extraCharges: [],
  extrasTotal: 0,
  depositReturned: null,
  confirmedAt: null,
  cancelledAt: null,
  createdAt: new Date().toISOString(),
  owner: { phone: null, whatsapp: null },
  viewerRole: 'owner',
  unreadMessages: 0,
} as Rental;

beforeEach(() => jest.clearAllMocks());

describe('OwnerRental', () => {
  it("won't hand over the keys until the licence is checked, then records the handover", async () => {
    (getRental as jest.Mock).mockResolvedValue(base);
    (handOverCar as jest.Mock).mockResolvedValue({ ...base, status: 'on_trip', pickedUpAt: new Date().toISOString(), pickupOdometer: 42000 });
    render(<OwnerRental id="r-1" />);
    const button = await screen.findByRole('button', { name: 'Hand over the car' });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /seen the driving licence/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Odometer (miles)' }), { target: { value: '42000' } });
    fireEvent.click(button);
    await waitFor(() =>
      expect(handOverCar).toHaveBeenCalledWith('r-1', expect.objectContaining({
        licenceChecked: true,
        odometer: 42000,
        fuel: 'full',
        depositCollected: 200,
        paymentCollected: true,
      })),
    );
    expect(await screen.findByRole('heading', { name: 'Car is back' })).toBeInTheDocument();
  });

  it('suggests the extra-mileage charge on return and keeps it from the deposit', async () => {
    (getRental as jest.Mock).mockResolvedValue({
      ...base,
      status: 'on_trip',
      pickedUpAt: new Date().toISOString(),
      pickupOdometer: 42000,
      pickupFuel: 'full',
      depositCollected: 200,
      paymentStatus: 'paid',
    });
    (returnCar as jest.Mock).mockResolvedValue({ ...base, status: 'returned' });
    render(<OwnerRental id="r-1" />);
    fireEvent.change(await screen.findByRole('spinbutton', { name: /Odometer/ }), { target: { value: '42300' } });
    fireEvent.click(screen.getByRole('button', { name: /100 miles over the allowance: add US\$50\.00/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: /Deposit given back/ }), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /Close rental with US\$50\.00 extra/ }));
    await waitFor(() =>
      expect(returnCar).toHaveBeenCalledWith('r-1', {
        odometer: 42300,
        fuel: 'full',
        notes: undefined,
        extraCharges: [{ label: 'Extra 100 miles', amount: 50 }],
        depositReturned: 150,
      }),
    );
  });
});
