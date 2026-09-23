"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getMyGuideUnreadCount } from "@/lib/guides-api";

const POLL_INTERVAL_MS = 30_000;

export function useGuideUnreadCount() {
  const { token, ready } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!ready || !token) {
      setUnreadCount(0);
      return;
    }

    let active = true;
    const refresh = () => {
      getMyGuideUnreadCount(token)
        .then(({ count }) => {
          if (active) setUnreadCount(count);
        })
        .catch(() => undefined);
    };

    refresh();
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [ready, token]);

  return unreadCount;
}
