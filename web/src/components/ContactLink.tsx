'use client';

import type { AnchorHTMLAttributes } from 'react';
import { recordAdvertisementAnalyticsEvent, recordAnalyticsEvent, recordCreatorAnalyticsEvent } from '@/lib/analytics-api';

// A plain <a> that also fires the "contact_click" analytics event (Tech
// Spec §3.3) — call/WhatsApp/website links on the Destination Profile, the
// claimed-business contact card, the creator profile, and an
// advertisement's "Sponsored" card all funnel through this one component
// (exactly one of placeId/creatorId/advertisementId, same XOR as the
// backend) so the conversion signal is never forgotten on a new contact
// method.
export function ContactLink({
  placeId,
  creatorId,
  advertisementId,
  onClick,
  ...anchorProps
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  placeId?: string;
  creatorId?: string;
  advertisementId?: string;
}) {
  return (
    <a
      {...anchorProps}
      onClick={(e) => {
        if (placeId) recordAnalyticsEvent(placeId, 'contact_click');
        if (creatorId) recordCreatorAnalyticsEvent(creatorId, 'contact_click');
        if (advertisementId) recordAdvertisementAnalyticsEvent(advertisementId, 'contact_click');
        onClick?.(e);
      }}
    />
  );
}
