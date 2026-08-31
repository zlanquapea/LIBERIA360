import { MdAccessTime, MdDone, MdDoneAll } from 'react-icons/md';

// The little "Sending… / Delivered / Viewed" ladder under your own message
// bubble — same idea as any chat app's checkmarks, just spelled out in
// words too since a single vs. double check isn't obvious out of context.
// Shared by every in-platform message thread (bookings, food orders,
// support) so the read-receipt convention looks and behaves identically
// everywhere messages appear in the app.
export function MessageStatus({ sending, viewed }: { sending?: boolean; viewed?: boolean }) {
  if (sending) {
    return (
      <span className="flex items-center gap-1">
        <MdAccessTime aria-hidden className="h-3 w-3" />
        Sending…
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
