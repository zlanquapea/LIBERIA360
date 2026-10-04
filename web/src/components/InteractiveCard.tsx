'use client';

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';

/**
 * The card's physical feel: with a mouse it tilts a few degrees toward the
 * pointer while a soft light follows it across the surface; on touch it
 * just presses in. The motion lives in CSS (`.lib-card` in globals.css)
 * driven by custom properties set here, at most once per frame, so a grid
 * of cards stays cheap. Reduced-motion users get a flat card.
 */
export function InteractiveCard({
  className = '',
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      el.style.setProperty('--card-mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--card-my', `${(y * 100).toFixed(1)}%`);
      el.style.setProperty('--card-rx', `${((0.5 - y) * 5).toFixed(2)}deg`);
      el.style.setProperty('--card-ry', `${((x - 0.5) * 6).toFixed(2)}deg`);
    });
  }

  function handleLeave() {
    cancelAnimationFrame(frame.current);
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--card-rx', '0deg');
    el.style.setProperty('--card-ry', '0deg');
  }

  return (
    <div ref={ref} onPointerMove={handleMove} onPointerLeave={handleLeave} className={`lib-card ${className}`} style={style}>
      {children}
      <span aria-hidden className="lib-card__glare" />
    </div>
  );
}
