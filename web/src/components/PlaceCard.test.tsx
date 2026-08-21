import { render, screen } from '@testing-library/react';
import { PlaceCard } from './PlaceCard';
import type { Place } from '@/lib/types';

const BASE_PLACE: Place = {
  id: 'p1',
  name: 'CeeCee Beach',
  slug: 'ceecee-beach',
  description: 'A quiet beach just outside Monrovia.',
  type: 'nature_site',
  category: { id: 'c1', name: 'Beaches', slug: 'beaches', description: null, icon: '🏖️' },
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
  contactPhone: null,
  whatsapp: null,
  website: null,
  instagram: null,
  facebook: null,
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
  it('renders the place name, type, city/county, and rating', () => {
    render(<PlaceCard place={BASE_PLACE} />);
    expect(screen.getByRole('heading', { name: 'CeeCee Beach' })).toBeInTheDocument();
    expect(screen.getByText(/Nature Site/)).toBeInTheDocument();
    expect(screen.getByText(/Monrovia, Montserrado/)).toBeInTheDocument();
    expect(screen.getByText('4.5 (3 reviews)')).toBeInTheDocument();
  });

  it('links to the place detail page', () => {
    render(<PlaceCard place={BASE_PLACE} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/places/ceecee-beach');
  });

  it('shows the category icon placeholder when there is no photo yet', () => {
    const { container } = render(<PlaceCard place={BASE_PLACE} />);
    expect(screen.getByText('🏖️')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('shows the resolved cover photo instead of the placeholder once the place has one', () => {
    const { container } = render(<PlaceCard place={{ ...BASE_PLACE, images: ['/uploads/photo.jpg'] }} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('/uploads/photo.jpg'));
    expect(screen.queryByText('🏖️')).not.toBeInTheDocument();
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

  it('shows "Not yet rated" for a place with no reviews, not "0.0"', () => {
    render(<PlaceCard place={{ ...BASE_PLACE, rating: 0, reviewCount: 0 }} />);
    expect(screen.getByText('Not yet rated')).toBeInTheDocument();
  });
});
