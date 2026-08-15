'use client';

import { useEffect } from 'react';
import { fetchMe } from '@/lib/auth-api';
import { clearStoredAuth, getStoredAuth, setStoredAuth } from '@/lib/auth-storage';

// Renders nothing — mounted once in the root layout (same pattern as
// ServiceWorkerRegister) to refresh the cached user object from the API
// on load. Without this, a role change made through Team & Access (or any
// other server-side profile change) has no client-side signal that it
// happened: useAuth() reads whatever was cached in localStorage at the
// last login/signup, so a newly-promoted admin would see "doesn't have
// admin access" until they manually logged out and back in — even though
// the API itself already reflects the change on every request (the JWT
// strategy re-fetches the user from the DB, not from a stale token claim).
export function AuthRefresher() {
  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored) return;
    fetchMe(stored.token).then(
      (user) => setStoredAuth({ token: stored.token, user }),
      () => clearStoredAuth(), // token invalid/expired — stop serving a stale cached user
    );
  }, []);

  return null;
}
