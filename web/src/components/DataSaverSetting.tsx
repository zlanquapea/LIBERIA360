"use client";
import { useState } from "react";
import { setDataSaver, useDataSaver } from "@/hooks/useDataSaver";
export function DataSaverSetting() {
  const enabled = useDataSaver();
  const [error, setError] = useState("");
  return (
    <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-bold">Data Saver</h2>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Data Saver"
          className={`min-h-11 rounded-full px-4 text-sm font-semibold ${enabled ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
          onClick={() => {
            try {
              setDataSaver(!enabled);
              setError("");
            } catch {
              setError("This device could not save your preference.");
            }
          }}
        >
          {enabled ? "On" : "Off"}
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Prefer smaller uploaded photos and tap to play creator videos. Applies
        on this device. Some external images may still load at their original
        size.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {error}
        </p>
      )}
    </section>
  );
}
