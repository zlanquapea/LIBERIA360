"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/hooks/useAuth";
import { getGuide, type GuideSummary } from "@/lib/api";
import { getMyGuideConversations } from "@/lib/guides-api";
import { GuideMessenger } from "./GuideMessenger";

export function GuideConversationPage({
  guideId,
  visitorId,
}: {
  guideId: string;
  visitorId?: string;
}) {
  const { token, ready } = useAuth();
  const [guide, setGuide] = useState<GuideSummary | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!ready || !token) return;
    getMyGuideConversations(token)
      .then((items) => {
        const match = items.find(
          (item) =>
            item.guide.id === guideId &&
            (!visitorId || item.visitor?.id === visitorId),
        );
        if (!match) {
          setMissing(true);
          return;
        }
        return getGuide(match.guide.slug).then(setGuide);
      })
      .catch(() => setMissing(true));
  }, [guideId, ready, token, visitorId]);

  if (!ready || !token) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-slate-500">
        Log in to open this conversation.
      </main>
    );
  }
  if (missing) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <Link
          href="/messages"
          className="inline-flex items-center gap-2 text-sm font-bold text-brand-700"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to messages
        </Link>
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="font-display text-2xl font-black">
            Conversation not found
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            This saved conversation may have been removed or you may not be one
            of its participants.
          </p>
        </div>
      </main>
    );
  }
  if (!guide)
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-slate-500">
        Loading conversation…
      </main>
    );
  return <GuideMessenger guide={guide} initialVisitorId={visitorId} />;
}
