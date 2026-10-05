"use client";
import { useEffect } from "react";
import { apiRequest } from "@/lib/http";
export function GuideViewTracker({
  guideId,
  experienceId,
}: {
  guideId?: string;
  experienceId?: string;
}) {
  useEffect(() => {
    const key = `guide-view:${guideId ?? experienceId}`;
    let id = crypto.randomUUID();
    try {
      const old = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (old && Date.now() - old.at < 30 * 60 * 1000) id = old.id;
      else sessionStorage.setItem(key, JSON.stringify({ id, at: Date.now() }));
    } catch {
      /* Analytics must not prevent browsing when storage is disabled. */
    }
    apiRequest("/guide-insights/views", {
      method: "POST",
      body: JSON.stringify({ id, guideId, experienceId }),
    }).catch(() => {});
  }, [guideId, experienceId]);
  return null;
}
