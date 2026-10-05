import type { PublicTripSummary, TripHosting } from '@/lib/types';
import { BoardingPass } from './BoardingPass';
import { HostedTripCard } from './group-trips/HostedTripCard';

// A community trip people can request to join — drawn as a boarding pass
// (see BoardingPass); an organised trip people book spots on is drawn as
// its poster instead. The reveal sits on a wrapper so its animation never
// fights the card's own hover lift.
export function PublicTripCard({ trip }: { trip: PublicTripSummary }) {
  return (
    <div className="reveal-on-scroll h-full">
      {trip.hosting ? (
        <HostedTripCard trip={trip as PublicTripSummary & { hosting: TripHosting }} />
      ) : (
        <BoardingPass trip={trip} href={`/trips/${trip.id}`} />
      )}
    </div>
  );
}
