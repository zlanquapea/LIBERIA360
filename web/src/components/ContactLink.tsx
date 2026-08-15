'use client';

import type { AnchorHTMLAttributes } from 'react';
import { recordAnalyticsEvent } from '@/lib/analytics-api';

// A plain <a> that also fires the "contact_click" analytics event (Tech
// Spec §3.3) — call/WhatsApp/website links on the Destination Profile and
// the claimed-business contact card all funnel through this one component
// so the conversion signal is never forgotten on a new contact method.
export function ContactLink({
  placeId,
  onClick,
  ...anchorProps
}: AnchorHTMLAttributes<HTMLAnchorElement> & { placeId: string }) {
  return (
    <a
      {...anchorProps}
      onClick={(e) => {
        recordAnalyticsEvent(placeId, 'contact_click');
        onClick?.(e);
      }}
    />
  );
}
