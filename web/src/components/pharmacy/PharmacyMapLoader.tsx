"use client";
import dynamic from "next/dynamic";
export const PharmacyMapLoader = dynamic(
  () => import("./PharmacyMap").then((x) => x.PharmacyMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[28rem] animate-pulse rounded-2xl bg-slate-200"
        aria-label="Loading map"
      />
    ),
  },
);
