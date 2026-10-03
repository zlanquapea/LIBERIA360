"use client";
export function ConversationQuickReplies({ contextType, onSelect }: { contextType: string; onSelect: (text: string) => void }) {
  const replies = contextType === "booking" || contextType === "guide"
    ? ["Is my preferred date available?", "Where should we meet?", "What are the cancellation terms?"]
    : contextType === "trip"
      ? ["What time are we leaving?", "Where is the meeting point?", "What should I bring?"]
      : [];
  if (!replies.length) return null;
  return <div aria-label="Suggested messages" className="mb-3 flex gap-2 overflow-x-auto pb-1">
    {replies.map(text => <button type="button" key={text} onClick={() => onSelect(text)} className="min-h-10 shrink-0 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">{text}</button>)}
  </div>;
}
