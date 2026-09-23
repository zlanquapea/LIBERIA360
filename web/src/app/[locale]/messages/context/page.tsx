"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLoader } from "@/components/BrandLoader";
import { useAuth } from "@/hooks/useAuth";
import { createContextConversation } from "@/lib/conversations-api";

export default function MessageContextPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { token, ready } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    const type = params.get("type");
    const id = params.get("id");
    if (!type || !id) {
      setError("This conversation link is incomplete.");
      return;
    }
    createContextConversation(token, type, id)
      .then((conversation) => router.replace(`/messages/${conversation.id}`))
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not open this conversation.",
        ),
      );
  }, [ready, token, params, router]);

  if (error)
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-flag-700">
        {error}
      </main>
    );
  return (
    <main className="flex min-h-[50vh] items-center justify-center">
      <BrandLoader />
    </main>
  );
}
