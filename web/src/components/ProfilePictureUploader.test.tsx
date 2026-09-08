import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMessages } from '@/test/render-with-messages';
import { ProfilePictureUploader } from './ProfilePictureUploader';
import { setStoredAuth, clearStoredAuth, getStoredAuth } from '@/lib/auth-storage';
import type { AuthUser } from '@/lib/types';

function mockFetchRoutedByUrl(handlers: Record<string, { status: number; body: unknown }>) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const match = Object.entries(handlers).find(([path]) => url.includes(path));
    if (!match) throw new Error(`Unexpected fetch to ${url}`);
    const { status, body } = match[1];
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  }) as unknown as typeof fetch;
}

const BASE_USER: AuthUser = {
  id: 'u1',
  name: 'Ama Traveler',
  email: 'ama@example.com',
  phone: null,
  profileImage: null,
  authProvider: 'email',
  homeCounty: null,
  isAdmin: false,
  isSuperAdmin: false,
  travelerType: null,
  interests: [],
  twoFactorEnabled: false,
  emailVerified: true,
  pendingActivation: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('ProfilePictureUploader', () => {
  afterEach(() => {
    clearStoredAuth();
    jest.restoreAllMocks();
  });

  it("shows the user's initial when no photo is set, with an 'Add profile photo' control", () => {
    setStoredAuth({ token: 'tok', user: BASE_USER });
    renderWithMessages(<ProfilePictureUploader user={BASE_USER} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add profile photo' })).toBeInTheDocument();
    expect(screen.queryByText('Remove photo')).not.toBeInTheDocument();
  });

  it('uploads a photo and applies it to the account immediately, no separate Save step', async () => {
    setStoredAuth({ token: 'tok', user: BASE_USER });
    mockFetchRoutedByUrl({
      '/uploads/image': { status: 201, body: { url: '/uploads/new-avatar.jpg' } },
      '/auth/me': { status: 200, body: { ...BASE_USER, profileImage: '/uploads/new-avatar.jpg' } },
    });

    const { container } = renderWithMessages(<ProfilePictureUploader user={BASE_USER} />);
    const file = new File(['(binary)'], 'avatar.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() => expect(getStoredAuth()?.user.profileImage).toBe('/uploads/new-avatar.jpg'));
    const calledUrls = (global.fetch as jest.Mock).mock.calls.map((call) => call[0]);
    expect(calledUrls.some((url) => String(url).includes('/uploads/image'))).toBe(true);
    expect(calledUrls.some((url) => String(url).includes('/auth/me'))).toBe(true);
  });

  it('confirms before removing an existing photo, and clears it only on confirm', async () => {
    const withPhoto: AuthUser = { ...BASE_USER, profileImage: '/uploads/existing.jpg' };
    setStoredAuth({ token: 'tok', user: withPhoto });
    mockFetchRoutedByUrl({
      '/auth/me': { status: 200, body: { ...withPhoto, profileImage: null } },
    });

    renderWithMessages(<ProfilePictureUploader user={withPhoto} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove photo' }));

    const dialog = await screen.findByRole('alertdialog');
    // Cancel first — must NOT touch the account.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    const reopened = await screen.findByRole('alertdialog');
    await userEvent.click(within(reopened).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(getStoredAuth()?.user.profileImage).toBeNull());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
