import { screen } from '@testing-library/react';
import { renderWithMessages as render } from '@/test/render-with-messages';
import { EventTicket } from './EventTicket';
import { BoardingPass } from './BoardingPass';
import { FeaturedDestinationCard } from './FeaturedDestinationCard';
import { CreatorCollectible } from './home/CreatorCollectible';
import { GuideCard } from './creator-guides/GuideCard';
import type { CreatorGuide, Creator, Event, Place, PublicTripSummary } from '@/lib/types';

jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ token: null, user: null, ready: true }) }));

const county = { id: 'c', name: 'Montserrado', slug: 'montserrado' };
const place = {
  id: 'p1',
  name: 'ELWA Beach',
  slug: 'elwa-beach',
  description: 'Golden sand and gentle waves.',
  city: 'Paynesville ',
  county,
  category: { id: 'cat', name: 'Beaches', slug: 'beaches', icon: 'SunIcon', description: null },
  images: [],
  rating: 0,
  reviewCount: 0,
  verificationStatus: 'verified',
} as unknown as Place;

function inDays(days: number, hourUtc = 18) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

describe('EventTicket', () => {
  const event = {
    id: 'e1',
    name: 'Monrovia Beach Jam',
    category: 'concert',
    startDate: inDays(3),
    endDate: null,
    images: [],
    place: null,
    locationText: 'Sinkor waterfront',
    county,
    ticketPrice: null,
    ticketTypes: [{ price: '15' }, { price: '10' }],
    interestedCount: 4,
    goingCount: 12,
  } as unknown as Event;

  it('shows the date stub, a countdown, the venue and the cheapest way in', () => {
    render(<EventTicket event={event} variant="feed" testId="t" />);
    expect(screen.getByRole('heading', { name: 'Monrovia Beach Jam' })).toBeInTheDocument();
    expect(screen.getByText('In 3 days')).toBeInTheDocument();
    expect(screen.getByText('Sinkor waterfront')).toBeInTheDocument();
    expect(screen.getByText('From US$10.00')).toBeInTheDocument();
    expect(screen.getByText('12 going')).toBeInTheDocument();
    expect(screen.getByText('4 interested')).toBeInTheDocument();
  });

  it('stamps a free event as Free', () => {
    render(<EventTicket event={{ ...event, ticketTypes: [] }} variant="shelf" testId="t" />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });
});

describe('BoardingPass', () => {
  const trip = {
    id: 'trip-1',
    title: 'Beach weekend',
    destination: place,
    description: null,
    coverImage: null,
    startDate: '2026-10-17',
    endDate: '2026-10-19',
    status: 'planning',
    admin: { name: 'Ama' },
    participantCount: 4,
    maxParticipants: 4,
    featuredCategory: null,
    createdAt: '2026-10-01',
  } as unknown as PublicTripSummary;

  it('reads like a pass: destination code, date, days, travellers and seats', () => {
    render(<BoardingPass trip={trip} href="/trips/trip-1" />);
    expect(screen.getByText('ELW')).toBeInTheDocument();
    expect(screen.getByText('17 OCT')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4/4')).toBeInTheDocument();
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('Organised by Ama')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/trips/trip-1');
  });

  it('shows the action on the stub instead of the organiser', () => {
    render(<BoardingPass trip={{ ...trip, maxParticipants: null, startDate: null, endDate: null }} action={<button type="button">Use this itinerary</button>} />);
    expect(screen.getByRole('button', { name: 'Use this itinerary' })).toBeInTheDocument();
    expect(screen.getByText('Flexible')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('FeaturedDestinationCard', () => {
  it('is one link with the Featured sash, tidy location and seal', () => {
    render(<FeaturedDestinationCard place={place} active />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/places/elwa-beach');
    expect(screen.getAllByText('Featured').length).toBeGreaterThan(0);
    expect(screen.getByText('Beaches · Paynesville, Montserrado')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Verified' })).toBeInTheDocument();
  });
});

describe('CreatorCollectible', () => {
  const creator = {
    id: 'cr1',
    name: 'Ama Kollie',
    username: 'ama',
    bio: 'Sunsets and street food.',
    profileImage: null,
    coverImage: null,
    category: 'photographer',
    county,
    locationsCovered: [],
    followerCount: 1200,
    rating: 4.8,
    reviewCount: 9,
    yearsExperience: 6,
    verificationStatus: 'verified',
    featured: true,
  } as unknown as Creator;

  it('shows only real stats, and the holo foil only for verified creators', () => {
    const { container, rerender } = render(<CreatorCollectible creator={creator} />);
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Verified creator')).toBeInTheDocument();
    expect(container.querySelector('.lib-holo')).not.toBeNull();

    rerender(<CreatorCollectible creator={{ ...creator, verificationStatus: 'unverified', followerCount: 0, reviewCount: 0, yearsExperience: null } as unknown as Creator} />);
    expect(container.querySelector('.lib-holo')).toBeNull();
    expect(screen.queryByText('Followers')).not.toBeInTheDocument();
  });
});

describe('GuideCard', () => {
  const guide = {
    id: 'g1',
    slug: 'beach-day',
    title: 'Beach day',
    summary: 'Three beaches before sunset.',
    coverImage: null,
    creator: { verificationStatus: 'verified' },
    stops: Array.from({ length: 7 }, (_, i) => ({ day: 1, note: null, place: { ...place, id: `p${i}`, name: `Stop ${i + 1}` } })),
  } as unknown as CreatorGuide;

  it('draws up to five numbered stops on the trail, then a count of the rest', () => {
    render(<GuideCard guide={guide} byLabel="By Ama" placesLabel="7 places" />);
    const trail = screen.getByRole('list', { name: '7 places' });
    expect(trail.querySelectorAll('li')).toHaveLength(6);
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('Stop 1 → Stop 2 → Stop 3 → Stop 4 → Stop 5')).toBeInTheDocument();
  });
});
