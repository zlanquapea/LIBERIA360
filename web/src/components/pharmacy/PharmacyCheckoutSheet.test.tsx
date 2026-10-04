import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { PharmacyCheckoutSheet } from './PharmacyCheckoutSheet';
import { createPharmacyOrder, deleteUnattachedPrescription, uploadPrescription } from '@/lib/pharmacy-api';
import type { Pharmacy, PharmacyProduct } from '@/lib/pharmacy-api';

jest.mock('@/lib/pharmacy-api', () => ({
  ...jest.requireActual('@/lib/pharmacy-api'),
  uploadPrescription: jest.fn(),
  createPharmacyOrder: jest.fn(),
  deleteUnattachedPrescription: jest.fn(),
}));

const upload = uploadPrescription as jest.Mock;
const createOrder = createPharmacyOrder as jest.Mock;
const deleteUnattached = deleteUnattachedPrescription as jest.Mock;

const pharmacy: Pharmacy = {
  id: 'pharmacy-1',
  name: 'Test Pharmacy',
  slug: 'test-pharmacy',
  placeId: null,
  address: '1 Test St',
  location: 'Monrovia',
  telephone: '+231770000000',
  logoUrl: null,
  coverUrl: null,
  latitude: null,
  longitude: null,
  pickupEnabled: true,
  deliveryEnabled: true,
  deliveryFee: 150,
  status: 'approved',
  sponsored: false,
  acceptsCash: true,
  mtnMomoNumber: '0886 000 111',
  orangeMoneyNumber: null,
};

const rx: PharmacyProduct = { id: 'rx', pharmacyId: 'pharmacy-1', categoryId: 'c', name: 'Amoxicillin', imageUrl: null, price: 10, prescriptionRequired: true, isVisible: true, inventory: { quantity: 5 } };
const otc: PharmacyProduct = { id: 'otc', pharmacyId: 'pharmacy-1', categoryId: 'c', name: 'Vitamin C', imageUrl: null, price: 5, prescriptionRequired: false, isVisible: true, inventory: { quantity: 20 } };

function Harness({ initial }: { initial: Record<string, number> }) {
  const [cart, setCart] = useState(initial);
  return (
    <PharmacyCheckoutSheet
      open
      onClose={() => undefined}
      pharmacy={pharmacy}
      products={[rx, otc]}
      cart={cart}
      onQuantityChange={(id, q) => setCart((c) => ({ ...c, [id]: Math.max(0, q) }))}
      signedIn
      loginHref="/login"
      onPlaced={() => undefined}
    />
  );
}

function pickFile(name = 'script.jpg') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['x'], name, { type: 'image/jpeg' })] } });
}

function toCheckout() {
  fireEvent.click(screen.getByRole('button', { name: /checkout/i }));
}

beforeEach(() => {
  jest.clearAllMocks();
  deleteUnattached.mockResolvedValue(undefined);
});

describe('PharmacyCheckoutSheet', () => {
  it('reuses the uploaded prescription when an order is retried', async () => {
    upload.mockResolvedValue('rx-upload-1');
    createOrder.mockRejectedValueOnce(new Error('Amoxicillin does not have enough stock')).mockResolvedValueOnce({ id: 'o1', status: 'under_review' });
    render(<Harness initial={{ rx: 1 }} />);
    toCheckout();
    pickFile();
    fireEvent.click(screen.getByRole('checkbox', { name: /i consent/i }));
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('enough stock');
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
    expect(upload).toHaveBeenCalledTimes(1);
    expect(createOrder.mock.calls[1][0]).toEqual(expect.objectContaining({ prescriptionId: 'rx-upload-1', consentToPrescriptionProcessing: true }));
  });

  it('deletes a cached upload as soon as a different file is chosen', async () => {
    upload.mockResolvedValue('rx-upload-1');
    createOrder.mockRejectedValue(new Error('nope'));
    render(<Harness initial={{ rx: 1 }} />);
    toCheckout();
    pickFile('first.jpg');
    fireEvent.click(screen.getByRole('checkbox', { name: /i consent/i }));
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await screen.findByRole('alert');
    pickFile('second.jpg');
    expect(deleteUnattached).toHaveBeenCalledWith('rx-upload-1');
  });

  it('needs the prescription and consent before placing a prescription order', async () => {
    render(<Harness initial={{ rx: 1 }} />);
    toCheckout();
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/upload a photo or pdf/i);
    pickFile();
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/tick the box/i);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('pays mobile money up front on an ordinary order, to the pharmacy number', async () => {
    createOrder.mockResolvedValue({ id: 'o1', status: 'pending' });
    render(<Harness initial={{ otc: 2 }} />);
    toCheckout();
    fireEvent.click(screen.getByLabelText(/mtn momo/i));
    expect(screen.getByText('0886 000 111')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/transaction id/i);
    fireEvent.change(screen.getByPlaceholderText(/MP240115/), { target: { value: 'MP123456' } });
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    expect(createOrder.mock.calls[0][0]).toEqual(
      expect.objectContaining({ paymentMethod: 'mtn_momo', paymentReference: 'MP123456', items: [{ productId: 'otc', quantity: 2 }] }),
    );
  });

  it('defers mobile money on a prescription order until the pharmacist approves', async () => {
    upload.mockResolvedValue('rx-upload-1');
    createOrder.mockResolvedValue({ id: 'o1', status: 'under_review' });
    render(<Harness initial={{ rx: 1 }} />);
    toCheckout();
    fireEvent.click(screen.getByLabelText(/mtn momo/i));
    expect(screen.getByText(/after the pharmacist approves your prescription/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/MP240115/)).not.toBeInTheDocument();
    pickFile();
    fireEvent.click(screen.getByRole('checkbox', { name: /i consent/i }));
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    expect(createOrder.mock.calls[0][0].paymentReference).toBeUndefined();
  });

  it('asks for an address and phone for delivery', async () => {
    render(<Harness initial={{ otc: 1 }} />);
    toCheckout();
    fireEvent.click(screen.getByLabelText(/delivery/i));
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/delivery address/i);
    fireEvent.change(screen.getByPlaceholderText(/blue church/i), { target: { value: 'Behind the blue church, Sinkor' } });
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/phone number/i);
  });
});
