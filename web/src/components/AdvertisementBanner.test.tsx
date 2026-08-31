import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdvertisementBanner } from './AdvertisementBanner';
import type { Advertisement } from '@/lib/types';

jest.mock('./AdvertisementCard', () => ({
  AdvertisementCard: ({ ad, onDismiss }: { ad: Advertisement; onDismiss: () => void }) => (
    <article>
      <span>{ad.title}</span>
      <button type="button" onClick={onDismiss}>Dismiss {ad.title}</button>
    </article>
  ),
}));

function makeAd(id: string, title: string): Advertisement {
  return {
    id, owner: null, ownerUserId: 'owner-1', type: 'business', title,
    description: `${title} description`, images: [], priceLabel: null,
    contactPhone: null, contactWhatsapp: null, contactEmail: null, externalLink: null,
    reviewStatus: 'approved', rejectionReason: null, submittedAt: null, reviewedAt: null,
    reviewedByUserId: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const ads = [makeAd('a1', 'First ad'), makeAd('a2', 'Second ad'), makeAd('a3', 'Third ad')];

describe('AdvertisementBanner responsive carousel', () => {
  it('renders a mobile slider and a responsive desktop grid', () => {
    render(<AdvertisementBanner ads={ads} />);
    expect(screen.getByTestId('sponsored-mobile-slider')).toBeInTheDocument();
    const grid = screen.getByTestId('sponsored-card-grid');
    expect(within(grid).getByText('First ad')).toBeInTheDocument();
    expect(within(grid).getByText('Second ad')).toBeInTheDocument();
    expect(within(grid).getByText('Third ad')).toBeInTheDocument();
    expect(grid).toHaveClass('hidden', 'lg:grid', 'grid-cols-3', 'xl:grid-cols-4');
    expect(screen.getByRole('button', { name: 'Previous advertisement' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next advertisement' })).toBeEnabled();
  });

  it('dismisses only the selected advertisement and keeps the remaining cards stable', async () => {
    const user = userEvent.setup();
    render(<AdvertisementBanner ads={ads} />);
    await user.click(screen.getAllByRole('button', { name: 'Dismiss Second ad' })[0]);
    expect(screen.queryAllByText('Second ad')).toHaveLength(0);
    expect(screen.getAllByText('First ad')).toHaveLength(2);
    expect(screen.getAllByText('Third ad')).toHaveLength(2);
  });

  it('renders no sponsored section for empty inventory', () => {
    const { container } = render(<AdvertisementBanner ads={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
