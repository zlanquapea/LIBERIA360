import { ConversationScreen } from "@/components/ConversationScreen";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ guideId: string }>;
}) {
  const { guideId } = await params;
  return <ConversationScreen conversationId={guideId} />;
}
