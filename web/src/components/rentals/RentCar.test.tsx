import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RentCar } from './RentCar';
import { bookRental, getRentalTerms } from '@/lib/rentals-api';
import { getCarListingAvailability } from '@/lib/car-rentals-api';
import { addDays, todayInLiberia } from '@/lib/stays';
import type { CarListing } from '@/lib/types';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'renter-1', name: 'Comfort Doe', phone: '0886 123 456' }, ready: true }),
}));
jest.mock('@/lib/rentals-api', () => ({ getRentalTerms: jest.fn(), bookRental: jest.fn() }));
jest.mock('@/lib/car-rentals-api', () => ({ getCarListingAvailability: jest.fn() }));

const pickup = addDays(todayInLiberia(), 2);
const back = addDays(pickup, 3);

const listing = {
  id: 'car-1',
  title: 'Toyota RAV4 2021',
  pricePerDay: 60,
  pricePerHour: null,
  minRentalDays: 1,
  minRentalHours: null,
  withDriverAvailable: true,
  driverFeePerDay: 25,
  driverFeePerHour: null,
  additionalDriverAllowed: false,
  additionalDriverFee: null,
  deliveryAvailable: true,
  deliveryFee: 20,
  securityDeposit: 200,
  mileageLimitPerDay: 150,
  excessMileageFee: 0.5,
  minDriverAge: 23,
  pickupLocation: 'Sinkor',
} as unknown as CarListing;

beforeEach(() => {
  jest.clearAllMocks();
  (getRentalTerms as jest.Mock).mockResolvedValue({
    paymentOptions: [
      { method: 'cash_at_pickup', label: 'Cash at pickup', account: null },
      { method: 'mtn_momo', label: 'MTN MoMo', account: '0886 222 333' },
      { method: 'orange_money', label: 'Orange Money', account: '0777 444 555' },
    ],
    mobileMoneyAccountName: 'Kollie Car Hire',
    depositAmount: 200,
    minDriverAge: 23,
    instantBook: false,
  });
  (getCarListingAvailability as jest.Mock).mockResolvedValue({ carListingId: 'car-1', unavailable: [] });
});

describe('RentCar', () => {
  it('adds up the trip line by line, with the deposit and mileage spelled out', async () => {
    render(<RentCar listing={listing} initialPickupDate={pickup} initialReturnDate={back} />);
    expect(await screen.findByText(/Pay with Cash at pickup, MTN MoMo, Orange Money/)).toBeInTheDocument();
    expect(screen.getByText('US$60.00 × 3 days')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /Add a driver/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Deliver the car to me/ }));
    expect(screen.getByText('Driver')).toBeInTheDocument();
    expect(screen.getByText('US$75.00')).toBeInTheDocument();
    expect(screen.getAllByText('US$275.00').length).toBeGreaterThan(0);
    expect(screen.getByText(/refundable deposit of US\$200\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Includes 150 miles a day/)).toBeInTheDocument();
  });

  it('stops before checkout when the car is already taken', async () => {
    (getCarListingAvailability as jest.Mock).mockResolvedValue({
      carListingId: 'car-1',
      unavailable: [{ startDate: back, endDate: back, source: 'booking' }],
    });
    render(<RentCar listing={listing} initialPickupDate={pickup} initialReturnDate={back} />);
    expect(await screen.findByText(/already booked/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to checkout/ })).toBeDisabled();
  });

  it('books with Orange Money, the licence and the age check', async () => {
    (bookRental as jest.Mock).mockResolvedValue({ id: 'r-1' });
    render(<RentCar listing={listing} initialPickupDate={pickup} initialReturnDate={back} />);
    fireEvent.click(await screen.findByRole('button', { name: /Continue to checkout/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Orange Money/ }));
    expect(screen.getByText('0777 444 555')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Submit payment & book/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/licence/);
    fireEvent.change(screen.getByPlaceholderText('As on your licence'), { target: { value: 'LR-778899' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit payment & book/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 23/);
    fireEvent.click(screen.getByRole('checkbox', { name: /at least 23/ }));
    fireEvent.change(screen.getByPlaceholderText(/MP240115/), { target: { value: 'OM555.1' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit payment & book/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/account/rentals/r-1'));
    expect(bookRental).toHaveBeenCalledWith(
      expect.objectContaining({
        carListingId: 'car-1',
        rentalUnit: 'day',
        pickupDate: pickup,
        returnDate: back,
        renterName: 'Comfort Doe',
        renterPhone: '0886 123 456',
        licenceNumber: 'LR-778899',
        ageConfirmed: true,
        paymentMethod: 'orange_money',
        paymentReference: 'OM555.1',
      }),
    );
  });
});
