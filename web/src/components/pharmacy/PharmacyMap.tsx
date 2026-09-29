"use client";
import { useState } from "react";
import { AdvancedMarker, InfoWindow, Map, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import type { Pharmacy } from "@/lib/pharmacy-api";
import { GOOGLE_MAPS_MAP_ID } from "@/lib/google-maps";
import { GoogleMapsProvider } from "../GoogleMapsProvider";
import { BrandMapPin, CENTERED_MARKER_ANCHOR } from "../MapMarkerContent";

function PharmacyMarker({
  pharmacy,
  selected,
  onSelect,
  onDeselect,
}: {
  pharmacy: Pharmacy;
  selected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: Number(pharmacy.latitude), lng: Number(pharmacy.longitude) }}
        onClick={onSelect}
        {...CENTERED_MARKER_ANCHOR}
      >
        <BrandMapPin />
      </AdvancedMarker>
      {selected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onDeselect}>
          <strong>{pharmacy.name}</strong>
          <br />
          {pharmacy.address}
        </InfoWindow>
      )}
    </>
  );
}

export function PharmacyMap({ pharmacies }: { pharmacies: Pharmacy[] }) {
  const pins = pharmacies.filter(
    (p) => p.latitude != null && p.longitude != null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div
      className="h-[28rem] overflow-hidden rounded-2xl border"
      aria-label="Pharmacy map"
    >
      <GoogleMapsProvider>
        <Map
          mapId={GOOGLE_MAPS_MAP_ID}
          defaultCenter={{ lat: 6.3156, lng: -10.8074 }}
          defaultZoom={12}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          className="h-full w-full"
        >
          {pins.map((p) => (
            <PharmacyMarker
              key={p.id}
              pharmacy={p}
              selected={p.id === selectedId}
              onSelect={() => setSelectedId(p.id)}
              onDeselect={() => setSelectedId((current) => (current === p.id ? null : current))}
            />
          ))}
        </Map>
      </GoogleMapsProvider>
      {!pins.length && (
        <p className="p-4">No mapped pharmacies match these filters.</p>
      )}
    </div>
  );
}
