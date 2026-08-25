import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportButton } from './ReportButton';
import { setStoredAuth, clearStoredAuth } from '@/lib/auth-storage';
import type { AuthUser } from '@/lib/types';

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

const USER: AuthUser = {
  id: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  phone: null,
  authProvider: 'email',
  homeCounty: null,
  isAdmin: false,
  isSuperAdmin: false,
  travelerType: null,
  interests: [],
  twoFactorEnabled: false,
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('ReportButton', () => {
  afterEach(() => {
    clearStoredAuth();
    jest.restoreAllMocks();
  });

  it('renders nothing when signed out', async () => {
    const { container } = render(<ReportButton targetType="review" targetId="r1" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows a Report link once signed in, and expands a form on click', async () => {
    setStoredAuth({ token: 'tok', user: USER });
    render(<ReportButton targetType="review" targetId="r1" />);

    const reportLink = await screen.findByRole('button', { name: /report/i });
    await userEvent.click(reportLink);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit report/i })).toBeInTheDocument();
  });

  it('submits the selected reason and shows a confirmation afterward', async () => {
    setStoredAuth({ token: 'tok', user: USER });
    mockFetchOnce(201, {});
    render(<ReportButton targetType="event" targetId="e1" />);

    await userEvent.click(await screen.findByRole('button', { name: /report/i }));
    await userEvent.selectOptions(screen.getByRole('combobox'), 'inappropriate');
    await userEvent.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => expect(screen.getByText(/sent to the team/i)).toBeInTheDocument());

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/reports');
    expect(JSON.parse(init.body)).toEqual({
      targetType: 'event',
      targetId: 'e1',
      reason: 'inappropriate',
    });
  });

  it('renders a custom trigger label without changing submit behavior', async () => {
    setStoredAuth({ token: 'tok', user: USER });
    render(<ReportButton targetType="business" targetId="b1" label="Suggest an update" />);

    expect(await screen.findByRole('button', { name: /suggest an update/i })).toBeInTheDocument();
  });

  it('shows the API error message and stays open on failure', async () => {
    setStoredAuth({ token: 'tok', user: USER });
    mockFetchOnce(429, { message: 'Too many requests' });
    render(<ReportButton targetType="review" targetId="r1" />);

    await userEvent.click(await screen.findByRole('button', { name: /report/i }));
    await userEvent.click(screen.getByRole('button', { name: /submit report/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
    expect(screen.getByRole('button', { name: /submit report/i })).toBeInTheDocument();
  });
});
