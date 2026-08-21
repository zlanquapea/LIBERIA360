'use client';

import type { AnchorHTMLAttributes } from 'react';
import { recordAnalyticsEvent, recordCreatorAnalyticsEvent } from '@/lib/analytics-api';

// A plain <a> that also fires the "contact_click" analytics event (Tech
// Spec §3.3) — call/WhatsApp/website links on the Destination Profile, the
// claimed-business contact card, and the creator profile all funnel
// through this one component (exactly one of placeId/creatorId, same XOR
// as the backend) so the conversion signal is never forgotten on a new
// contact method.
export function ContactLink({
  placeId,
  creatorId,
  onClick,
  ...anchorProps
}: AnchorHTMLAttributes<HTMLAnchorElement> & { placeId?: string; creatorId?: string }) {
  return (
    <a
      {...anchorProps}
      onClick={(e) => {
        if (placeId) recordAnalyticsEvent(placeId, 'contact_click');
        if (creatorId) recordCreatorAnalyticsEvent(creatorId, 'contact_click');
        onClick?.(e);
      }}
    />
  );
}
