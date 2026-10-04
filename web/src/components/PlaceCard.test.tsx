import { screen } from '@testing-library/react';
import { renderWithMessages as render } from '@/test/render-with-messages';
import { PlaceCardCompact } from './PlaceCardCompact';
import { PlaceCard } from './PlaceCard';
import type { OpeningPeriod, Place } from '@/lib/types';

const BASE_PLACE: Place = {
  id: 'p1',
  name: 'CeeCee Beach',
  slug: 'ceecee-beach',
  description: 'A quiet beach just outside Monrovia.',
  type: 'nature_site',
  category: { id: 'c1', name: 'Beaches', slug: 'beaches', description: null, icon: 'SunIcon' },
  tags: [],
  county: {
    id: 'co1',
    name: 'Montserrado',
    slug: 'montserrado',
    rolloutStage: 1,
    icon: null,
    emergencyNumber: null,
    safetyTips: [],
    localCustoms: null,
  },
  city: 'Monrovia',
  latitude: 6.3,
  longitude: -10.8,
  distanceFromMonroviaKm: 5,
  recommendedVisitLength: null,
  estimatedCostEntry: null,
  estimatedCostGuide: null,
  estimatedCostTransport: null,
  images: [],
  videos: [],
  openingHours: null,
  structuredHours: null,
  contactPhone: null,
  whatsapp: null,
  website: null,
  instagram: null,
  facebook: null,
  amenities: [],
  accessibilityNotes: null,
  transportNotes: null,
  practicalInfoSource: null,
  practicalInfoCheckedAt: null,
  rating: 4.5,
  reviewCount: 3,
  verificationStatus: 'verified',
  featured: false,
  reviewStatus: 'approved',
  ownerUserId: null,
  rejectionReason: null,
  submittedAt: null,
  reviewedAt: null,
  reviewedByUserId: null,
};

describe('PlaceCard', () => {
  it('renders the name with its trust seal, a tidy location, the category and the rating', () => {
    render(<PlaceCard place={{ ...BASE_PLACE, city: 'Monrovia ' }} />);
    expect(screen.getByRole('heading', { name: /CeeCee Beach/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Verified' })).toBeInTheDocument();
    expect(screen.getByText('Monrovia, Montserrado')).toBeInTheDocument();
    expect(screen.getByText('Beaches')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rated 4.5 out of 5 from 3 reviews' })).toBeInTheDocument();
  });

  it('links to the place detail page', () => {
    render(<PlaceCard place={BASE_PLACE} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/places/ceecee-beach');
  });

  it('shows the category backdrop when there is no photo yet', () => {
    const { container } = render(<PlaceCard place={BASE_PLACE} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('shows the resolved cover photo instead of the backdrop once the place has one', () => {
    const { container } = render(<PlaceCard place={{ ...BASE_PLACE, images: ['/uploads/photo.jpg'] }} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('/uploads/photo.jpg'));
  });

  it('shows "In Monrovia" instead of "0 km from Monrovia" for a 0km distance', () => {
    render(<PlaceCard place={{ ...BASE_PLACE, distanceFromMonroviaKm: 0 }} />);
    expect(screen.getByText('In Monrovia')).toBeInTheDocument();
  });

  it('prefers a distanceOverride (e.g. Near Me results) over the catalog distance', () => {
    render(<PlaceCard place={BASE_PLACE} distanceOverride="1.2 km away" />);
    expect(screen.getByText('1.2 km away')).toBeInTheDocument();
    expect(screen.queryByText(/km from Monrovia/)).not.toBeInTheDocument();
  });

  it('calls an unreviewed place "New" rather than "Not yet rated" or "0.0"', () => {
    render(<PlaceCard place={{ ...BASE_PLACE, rating: 0, reviewCount: 0 }} />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.queryByText(/Not yet rated|0\.0/)).not.toBeInTheDocument();
  });

  it('shows the entry cost when the place has one on file', () => {
    render(<PlaceCard place={{ ...BASE_PLACE, estimatedCostEntry: 5 }} />);
    expect(screen.getByText('US$5.00 entry')).toBeInTheDocument();
  });

  it('says "Free entry" rather than "$0.00" for a zero entry cost', () => {
    render(<PlaceCard place={{ ...BASE_PLACE, estimatedCostEntry: 0 }} />);
    expect(screen.getByText('Free entry')).toBeInTheDocument();
  });

  it('omits the price entirely when no cost is on file', () => {
    render(<PlaceCard place={BASE_PLACE} />);
    expect(screen.queryByText(/entry|Not listed/)).not.toBeInTheDocument();
  });

  it('says "Open now" only while the listed hours are open', () => {
    const now = new Date();
    const today = now.getUTCDay() as OpeningPeriod['dayOfWeek'];
    const allDay: OpeningPeriod[] = [{ dayOfWeek: today, opens: '00:00', closes: '23:59' }];
    const { unmount } = render(<PlaceCard place={{ ...BASE_PLACE, structuredHours: allDay }} />);
    expect(screen.getByText('Open now')).toBeInTheDocument();
    unmount();
    render(<PlaceCard place={{ ...BASE_PLACE, structuredHours: [{ dayOfWeek: ((today + 3) % 7) as OpeningPeriod['dayOfWeek'], opens: '09:00', closes: '17:00' }] }} />);
    expect(screen.queryByText('Open now')).not.toBeInTheDocument();
  });
});

describe('PlaceCardCompact', () => {
  it('puts the name, seal, location and rating over the photo, with a save button beside the link', () => {
    render(<PlaceCardCompact place={{ ...BASE_PLACE, images: ['/uploads/photo.jpg'] }} verificationStatus="verified" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/places/ceecee-beach');
    expect(screen.getByRole('heading', { name: /CeeCee Beach/ })).toBeInTheDocument();
    expect(screen.getByText('Monrovia, Montserrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save this place' })).not.toBeNull();
    expect(link).not.toContainElement(screen.getByRole('button', { name: 'Save this place' }));
  });

  it('spans two columns as the lead feature tile and shows the description', () => {
    const { container } = render(<PlaceCardCompact place={BASE_PLACE} size="feature" />);
    expect(container.firstElementChild).toHaveClass('col-span-2');
    expect(screen.getByText('A quiet beach just outside Monrovia.')).toBeInTheDocument();
  });
});
