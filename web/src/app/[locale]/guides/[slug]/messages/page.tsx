import { getGuide } from "@/lib/api";
import { GuideMessenger } from "@/components/GuideMessenger";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  return {
    title: `Message ${guide.slug} — LIBERIA360`,
    description: `Have a saved conversation with ${guide.slug}, a verified Liberia trip guide.`,
  };
}

export default async function GuideMessagesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  return <GuideMessenger guide={guide} />;
}
