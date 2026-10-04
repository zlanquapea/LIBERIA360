import type { PublicTripSummary } from '@/lib/types';
import { BoardingPass } from './BoardingPass';

// A community trip people can request to join — drawn as a boarding pass
// (see BoardingPass). The reveal sits on a wrapper so its animation never
// fights the pass's own hover lift.
export function PublicTripCard({ trip }: { trip: PublicTripSummary }) {
  return (
    <div className="reveal-on-scroll h-full">
      <BoardingPass trip={trip} href={`/trips/${trip.id}`} />
    </div>
  );
}
