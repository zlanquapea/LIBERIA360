'use client';

import { useEffect, useState } from 'react';

const SPLASH_SESSION_KEY = 'liberia360:splash-seen';
const SPLASH_DISPLAY_MS = 5000;
const SPLASH_EXIT_MS = 400;

export function SplashScreen() {
  // Render the splash during SSR so it is already covering the page at first paint.
  // The document-level session gate hides it before paint on repeat visits.
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let shouldShow = true;
    try {
      shouldShow = window.sessionStorage.getItem(SPLASH_SESSION_KEY) !== '1';
      if (shouldShow) window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    } catch {
      // Private browsing and storage-disabled contexts still get the splash.
    }

    if (!shouldShow) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Keep the designed first impression on screen for five seconds. Reduced
    // motion changes the fade itself, not the requested display duration.
    const exitDelay = SPLASH_DISPLAY_MS - (reducedMotion ? 60 : SPLASH_EXIT_MS);
    const removeDelay = SPLASH_DISPLAY_MS;

    const exitTimer = window.setTimeout(() => setLeaving(true), exitDelay);
    const removeTimer = window.setTimeout(() => setVisible(false), removeDelay);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`splash-screen ${leaving ? 'splash-screen--leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading LIBERIA360"
    >
      <div className="splash-screen__grain" aria-hidden="true" />
      <div className="splash-screen__aurora splash-screen__aurora--one" aria-hidden="true" />
      <div className="splash-screen__aurora splash-screen__aurora--two" aria-hidden="true" />

      <div className="splash-screen__stars" aria-hidden="true">
        <span className="splash-star splash-star--one" />
        <span className="splash-star splash-star--two" />
        <span className="splash-star splash-star--three" />
        <span className="splash-star splash-star--four" />
        <span className="splash-star splash-star--five" />
      </div>

      <div className="splash-screen__content">
        <p className="splash-screen__eyebrow">WELCOME TO</p>
        <div className="splash-screen__mark-wrap">
          <div className="splash-screen__ring splash-screen__ring--outer" aria-hidden="true" />
          <div className="splash-screen__ring splash-screen__ring--inner" aria-hidden="true" />
          <div className="splash-screen__logo-card">
            <img src="/logo.png" alt="LIBERIA360" className="splash-screen__logo" />
          </div>
          <span className="splash-screen__orbit splash-screen__orbit--gold" aria-hidden="true" />
          <span className="splash-screen__orbit splash-screen__orbit--green" aria-hidden="true" />
        </div>
        <h1 className="splash-screen__title">
          <span>DISCOVER</span> <strong>LIBERIA</strong>
        </h1>
        <p className="splash-screen__tagline">Everything Liberia. One place.</p>
        <div className="splash-screen__loading" aria-hidden="true">
          <span className="splash-screen__loading-track">
            <span className="splash-screen__loading-bar" />
          </span>
          <span className="splash-screen__loading-label">Opening your journey</span>
        </div>
      </div>

      <p className="splash-screen__footer">DISCOVER <span>•</span> EXPERIENCE <span>•</span> SHARE</p>
    </div>
  );
}
