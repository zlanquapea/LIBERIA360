'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const RAYS = [0, 60, 120, 180, 240, 300];

/** Fires the "Snap!" moment: returns a trigger and the burst to render
 * inside a `relative` element. A short vibration on phones that support
 * it; screen readers hear "Saved". */
export function useSnap() {
  const [key, setKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const snap = useCallback(() => {
    setKey((k) => k + 1);
    setActive(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), 950);
    try {
      navigator.vibrate?.([12, 40, 12]);
    } catch {
      // Vibration unsupported or blocked: the visual is enough.
    }
  }, []);

  return { snap, burst: active ? <SnapBurst key={key} /> : null };
}

function SnapBurst() {
  const t = useTranslations('common');
  return (
    <span className="snap-burst">
      {RAYS.map((angle) => (
        <span key={angle} aria-hidden className="snap-burst__ray" style={{ ['--snap-angle' as string]: `${angle}deg` }} />
      ))}
      <span className="snap-burst__label" role="status">
        {t('snapSaved')}
      </span>
    </span>
  );
}
