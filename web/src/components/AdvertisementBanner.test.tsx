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

describe('AdvertisementBanner grid', () => {
  it('renders every advertisement in a single responsive grid', () => {
    render(<AdvertisementBanner ads={ads} />);
    const grid = screen.getByTestId('sponsored-card-grid');
    expect(within(grid).getByText('First ad')).toBeInTheDocument();
    expect(within(grid).getByText('Second ad')).toBeInTheDocument();
    expect(within(grid).getByText('Third ad')).toBeInTheDocument();
    expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4');
  });

  it('dismisses only the selected advertisement and keeps the remaining cards stable', async () => {
    const user = userEvent.setup();
    render(<AdvertisementBanner ads={ads} />);
    await user.click(screen.getByRole('button', { name: 'Dismiss Second ad' }));
    expect(screen.queryByText('Second ad')).not.toBeInTheDocument();
    expect(screen.getByText('First ad')).toBeInTheDocument();
    expect(screen.getByText('Third ad')).toBeInTheDocument();
  });

  it('renders no sponsored section for empty inventory', () => {
    const { container } = render(<AdvertisementBanner ads={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
