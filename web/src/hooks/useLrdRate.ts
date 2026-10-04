'use client';

import { useEffect, useState } from 'react';
import { getTravelerInfo } from '@/lib/traveler-info-api';

// One request per page load, shared by every price on the page.
let pending: Promise<number | null> | null = null;

function loadRate(): Promise<number | null> {
  pending ??= getTravelerInfo()
    .then((info) => {
      const rate = Number(info.usdToLrdRate);
      return Number.isFinite(rate) && rate > 0 ? rate : null;
    })
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

/** The admin-set US$→L$ rate from /travel-info, or null until it loads
 * (or when none is set). */
export function useLrdRate(): number | null {
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    loadRate().then((r) => {
      if (live) setRate(r);
    });
    return () => {
      live = false;
    };
  }, []);
  return rate;
}
