import { getCounties } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { GuideApplicationForm } from "./GuideApplicationForm";

export const metadata = { title: "Become a Guide — LIBERIA360" };

export default async function ApplyGuidePage() {
  const counties = await getCounties();
  return (
    <main className="page-shell max-w-3xl pb-32">
      <PageHeader
        eyebrow="Grow local tourism"
        title="Become a guide or host"
        description="Share your knowledge of Liberia and offer trusted experiences to travelers. Applications are reviewed before profiles become public."
      />
      <GuideApplicationForm counties={counties} />
    </main>
  );
}
