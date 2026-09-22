import { GuideMessagesInbox } from "@/components/GuideMessagesInbox";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ guideId?: string; visitorId?: string }>;
}) {
  const params = await searchParams;
  return (
    <GuideMessagesInbox guideId={params.guideId} visitorId={params.visitorId} />
  );
}
