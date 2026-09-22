import { GuideConversationPage } from "@/components/GuideConversationPage";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ guideId: string }>;
  searchParams: Promise<{ visitorId?: string }>;
}) {
  const { guideId } = await params;
  const { visitorId } = await searchParams;
  return <GuideConversationPage guideId={guideId} visitorId={visitorId} />;
}
