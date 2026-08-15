'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getVapidPublicKey, subscribePush, unsubscribePush } from '@/lib/push-api';
import { getExistingSubscription, isPushSupported, subscribeToPush } from '@/lib/push-browser';
import { HttpError } from '@/lib/http';

export function usePushSubscription() {
  const { token, ready: authReady } = useAuth();
  const supported = isPushSupported();

  const [checking, setChecking] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported || !authReady) {
      if (authReady) setChecking(false);
      return;
    }
    let cancelled = false;
    Promise.all([getVapidPublicKey(), getExistingSubscription()])
      .then(([{ publicKey }, existing]) => {
        if (cancelled) return;
        setVapidPublicKey(publicKey);
        setSubscribed(existing !== null);
      })
      .catch(() => {
        // Checking current state is best-effort — leave subscribed at its
        // default (false) rather than blocking the toggle from rendering.
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supported, authReady]);

  const enable = useCallback(async () => {
    if (!token || !vapidPublicKey) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notifications were not allowed. Enable them in your browser settings to turn this on.');
        return;
      }
      const subscription = await subscribeToPush(vapidPublicKey);
      await subscribePush(token, subscription.toJSON() as PushSubscriptionJSON);
      setSubscribed(true);
    } catch (err) {
      // HttpError (our API rejected the subscribe call) and the
      // push-browser timeout above both carry a message worth showing;
      // anything else (a raw browser/DOMException) falls back to a generic
      // message rather than surfacing internals.
      setError(err instanceof HttpError || err instanceof Error ? err.message : 'Could not enable notifications. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [token, vapidPublicKey]);

  const disable = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const existing = await getExistingSubscription();
      if (existing) {
        const endpoint = existing.endpoint;
        await existing.unsubscribe();
        await unsubscribePush(token, endpoint);
      }
      setSubscribed(false);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not disable notifications. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [token]);

  return {
    supported,
    // Push needs a VAPID keypair configured server-side (api/README.md) —
    // without one, getVapidPublicKey() resolves publicKey: null and the
    // feature stays quietly unavailable rather than erroring.
    available: supported && vapidPublicKey !== null,
    checking,
    subscribed,
    busy,
    error,
    enable,
    disable,
  };
}
