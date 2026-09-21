import { screen } from '@testing-library/react';
import { renderWithMessages } from '@/test/render-with-messages';
import { TripCostSummary } from './TripCostSummary';
import type { ItineraryStopDetail } from '@/lib/types';

function stop(overrides: Partial<ItineraryStopDetail>): ItineraryStopDetail {
  return { day: 1, order: 0, notes: null, ...overrides };
}

describe('TripCostSummary', () => {
  it('renders nothing for a trip with no stops', () => {
    const { container } = renderWithMessages(<TripCostSummary stops={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sums a place entry fee, an event ticket price, and a car rental (price/day × min days)', () => {
    const stops: ItineraryStopDetail[] = [
      stop({ place: { estimatedCostEntry: 5 } as never }),
      stop({ event: { ticketPrice: '20.00', ticketTypes: [] } as never }),
      stop({ carListing: { pricePerDay: 60, minRentalDays: 2 } as never }),
    ];
    renderWithMessages(<TripCostSummary stops={stops} />);
    // 5 + 20 + (60 * 2) = 145
    expect(screen.getByText(/US\$145\.00/)).toBeInTheDocument();
  });

  it('treats a place with no estimated cost as free (0), not as excluded', () => {
    const stops: ItineraryStopDetail[] = [stop({ place: { estimatedCostEntry: null } as never })];
    renderWithMessages(<TripCostSummary stops={stops} />);
    expect(screen.getByText(/Free/)).toBeInTheDocument();
  });

  it('falls back to the cheapest ticket type when ticketPrice is unset', () => {
    const stops: ItineraryStopDetail[] = [
      stop({
        event: {
          ticketPrice: null,
          ticketTypes: [
            { price: '15.00' },
            { price: '8.00' },
            { price: '30.00' },
          ],
        } as never,
      }),
    ];
    renderWithMessages(<TripCostSummary stops={stops} />);
    expect(screen.getByText(/US\$8\.00/)).toBeInTheDocument();
  });

  it('treats an event with neither ticketPrice nor ticketTypes as free', () => {
    const stops: ItineraryStopDetail[] = [
      stop({ event: { ticketPrice: null, ticketTypes: [] } as never }),
    ];
    renderWithMessages(<TripCostSummary stops={stops} />);
    expect(screen.getByText(/Free/)).toBeInTheDocument();
  });
});
