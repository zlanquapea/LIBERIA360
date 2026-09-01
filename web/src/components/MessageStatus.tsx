import { MdAccessTime, MdDone, MdDoneAll } from 'react-icons/md';
import type { TripMessageDeliveryStatus } from '@/lib/types';

// The little "Sending… / Delivered / Viewed" ladder under your own message
// bubble — same idea as any chat app's checkmarks, just spelled out in
// words too since a single vs. double check isn't obvious out of context.
// Shared by every in-platform message thread (bookings, food orders,
// support, and the trip group chat) so the read-receipt convention looks
// and behaves identically everywhere messages appear in the app.
//
// Two call shapes: `viewed` (a plain boolean) is the original two-party
// shape — those threads only ever have Delivered/Viewed, so it's kept
// exactly as it always rendered. `status` is the trip chat's three-state
// Sent/Delivered/Read (see TripChatService.computeStatus on the backend)
// — a WhatsApp-style single check for Sent, double gray for Delivered,
// double brand-colored for Read.
export function MessageStatus({
  sending,
  viewed,
  status,
}: {
  sending?: boolean;
  viewed?: boolean;
  status?: TripMessageDeliveryStatus;
}) {
  if (sending) {
    return (
      <span className="flex items-center gap-1">
        <MdAccessTime aria-hidden className="h-3 w-3" />
        Sending…
      </span>
    );
  }
  if (status) {
    if (status === 'sent') {
      return (
        <span className="flex items-center gap-1">
          <MdDone aria-hidden className="h-3.5 w-3.5" />
          Sent
        </span>
      );
    }
    return (
      <span className={`flex items-center gap-1 ${status === 'read' ? 'text-brand-600 dark:text-brand-300' : ''}`}>
        <MdDoneAll aria-hidden className="h-3.5 w-3.5" />
        {status === 'read' ? 'Read' : 'Delivered'}
      </span>
    );
  }
  return (
    <span className={`flex items-center gap-1 ${viewed ? 'text-brand-600 dark:text-brand-300' : ''}`}>
      {viewed ? <MdDoneAll aria-hidden className="h-3.5 w-3.5" /> : <MdDone aria-hidden className="h-3.5 w-3.5" />}
      {viewed ? 'Viewed' : 'Delivered'}
    </span>
  );
}
