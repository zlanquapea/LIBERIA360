"use client";
import { useSyncExternalStore } from "react";
const KEY = "liberia360:data-saver";
const EVENT = "liberia360:data-saver-changed";
function snapshot() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved === "on";
  } catch {}
  return Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData,
  );
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
}
export function useDataSaver() {
  // Start conservatively during hydration, before browser preferences are known.
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
export function setDataSaver(enabled: boolean) {
  localStorage.setItem(KEY, enabled ? "on" : "off");
  window.dispatchEvent(new Event(EVENT));
}
