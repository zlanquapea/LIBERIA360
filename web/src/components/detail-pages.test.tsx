import { screen } from '@testing-library/react';
import { renderWithMessages as render } from '@/test/render-with-messages';
import { TripTimeline } from './trips/TripTimeline';
import { HoursStatus } from './place/HoursStatus';
import { WeeklyHours } from './place/WeeklyHours';
import type { ItineraryStopDetail, OpeningPeriod } from '@/lib/types';

const place = (slug: string, name: string) =>
  ({ id: slug, slug, name, city: 'Monrovia', county: { name: 'Montserrado' }, category: { name: 'Beaches' }, images: [] }) as never;

describe('TripTimeline', () => {
  it('groups stops by day with dates, links and notes', () => {
    const stops = [
      { day: 2, order: 0, notes: null, place: place('ceecee', 'CeeCee Beach') },
      { day: 1, order: 1, notes: 'Lunch here', place: place('grill', 'The Grill') },
      { day: 1, order: 0, notes: 'Go early', place: place('elwa', 'ELWA Beach') },
    ] as ItineraryStopDetail[];
    render(<TripTimeline stops={stops} startDate="2026-10-17" />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Day 1Sat, Oct 17', 'Day 2Sun, Oct 18']);
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/places/elwa', '/places/grill', '/places/ceecee']);
    expect(screen.getByText('“Go early”')).toBeInTheDocument();
  });

  it('says so when nothing is planned', () => {
    render(<TripTimeline stops={[]} startDate={null} />);
    expect(screen.getByText('No stops planned yet.')).toBeInTheDocument();
  });
});

describe('place hours', () => {
  const allDay = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, opens: '00:00', closes: '24:00' })) as OpeningPeriod[];

  it('shows 24-hour places plainly', () => {
    render(<HoursStatus hours={allDay} />);
    expect(screen.getByText('Open 24 hours')).toBeInTheDocument();
    render(<WeeklyHours hours={allDay} />);
    expect(screen.getByText('Open 24 hours, every day')).toBeInTheDocument();
  });

  it('falls back to the listed hours text, then to a call-ahead nudge', () => {
    const { rerender } = render(<HoursStatus hours={null} fallbackText="Mon–Sat 8am–6pm" />);
    expect(screen.getByText('Mon–Sat 8am–6pm')).toBeInTheDocument();
    rerender(<HoursStatus hours={null} />);
    expect(screen.getByText('Hours not listed — call ahead')).toBeInTheDocument();
  });

  it('lists the week Monday first', () => {
    const weekdays = [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, opens: '08:00', closes: '17:00' })) as OpeningPeriod[];
    render(<WeeklyHours hours={weekdays} />);
    const rows = screen.getAllByRole('row');
    expect(rows[0]).toHaveTextContent('Monday');
    expect(rows[6]).toHaveTextContent('Sunday');
    expect(rows[6]).toHaveTextContent('Closed');
  });
});
