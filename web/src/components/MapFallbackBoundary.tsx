'use client';

import { Component, type ReactNode } from 'react';

// Product review readout (Aug 22, 2026): "list fallback when tiles or
// markers fail." Leaflet doesn't expose a clean "the map broke" event for
// most real-world failures (a malformed place's lat/lng crashing a
// <Marker>, a Leaflet/CSS load issue), so a render-time error boundary is
// the actual mechanism — anything that throws while rendering the map
// subtree falls back to `fallback` instead of taking the whole page down.
export class MapFallbackBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
