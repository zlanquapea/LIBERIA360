"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createGuideConversation } from "@/lib/conversations-api";

export function GuideConversationLauncher({
  guideId,
  slug,
}: {
  guideId: string;
  slug: string;
}) {
  const { token, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace(
        `/login?next=${encodeURIComponent(`/guides/${slug}/messages`)}`,
      );
      return;
    }
    createGuideConversation(token, guideId)
      .then((conversation) => router.replace(`/messages/${conversation.id}`))
      .catch(() => router.replace(`/messages`));
  }, [guideId, ready, router, slug, token]);
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-500">
      Opening your private conversation…
    </main>
  );
}
