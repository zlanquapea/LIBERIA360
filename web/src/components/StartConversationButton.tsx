"use client";
import { useRouter } from "next/navigation";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/hooks/useAuth";
import {
  createCreatorConversation,
  createGuideConversation,
} from "@/lib/conversations-api";

export function StartConversationButton({
  type,
  targetId,
  label = "Message",
}: {
  type: "guide" | "creator";
  targetId: string;
  label?: string;
}) {
  const { token, ready } = useAuth();
  const router = useRouter();
  async function open() {
    if (!ready) return;
    if (!token) {
      router.push(
        `/login?next=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    try {
      const conversation =
        type === "guide"
          ? await createGuideConversation(token, targetId)
          : await createCreatorConversation(token, targetId);
      router.push(`/messages/${conversation.id}`);
    } catch {
      router.push("/messages");
    }
  }
  return (
    <button
      type="button"
      onClick={() => void open()}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-5 font-bold text-white transition hover:bg-brand-800"
    >
      <ChatBubbleLeftRightIcon className="h-5 w-5" />
      {label}
    </button>
  );
}
