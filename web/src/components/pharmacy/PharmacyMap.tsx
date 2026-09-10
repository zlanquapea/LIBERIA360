"use client";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { Pharmacy } from "@/lib/pharmacy-api";
import "leaflet/dist/leaflet.css";
export function PharmacyMap({ pharmacies }: { pharmacies: Pharmacy[] }) {
  const pins = pharmacies.filter(
    (p) => p.latitude != null && p.longitude != null,
  );
  return (
    <div
      className="h-[28rem] overflow-hidden rounded-2xl border"
      aria-label="Pharmacy map"
    >
      <MapContainer
        center={[6.3156, -10.8074]}
        zoom={12}
        className="h-full w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((p) => (
          <Marker
            key={p.id}
            position={[Number(p.latitude), Number(p.longitude)]}
          >
            <Popup>
              <strong>{p.name}</strong>
              <br />
              {p.address}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {!pins.length && (
        <p className="p-4">No mapped pharmacies match these filters.</p>
      )}
    </div>
  );
}
