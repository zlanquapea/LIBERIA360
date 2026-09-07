import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { ApiError, getBusinessBySlug, getMenuItems } from "@/lib/api";
import { RestaurantMenuOrdering } from "@/components/RestaurantMenuOrdering";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug).catch(() => null);
  if (!business) {
    return { title: "Menu — LIBERIA360" };
  }
  return { title: `Menu — ${business.name} — LIBERIA360` };
}

// Dedicated page for a restaurant's full menu and food-ordering flow — see
// MenuPreviewSection's doc comment on the Place/Business profile pages for
// why this moved off them (same "give it a whole page" move as
// businesses/[slug]/book/page.tsx did for the booking form). Reached via
// `/businesses/${business.slug}/menu` from either profile page's preview
// card, since MenuItem is only ever keyed by businessId — there's one
// canonical menu per business, not a separate copy per place.
export default async function BusinessMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const business = await getBusinessBySlug(slug).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  // Only restaurants have a menu at all — same gate as the preview's own
  // fetch on the profile pages (see MenuItemsManager's matching gate on
  // the owner side).
  if (!business || business.type !== "restaurant") {
    notFound();
  }

  const items = await getMenuItems(business.id);

  if (items.length === 0) {
    // Reachable only by a direct/stale link — the profile pages never
    // link here unless there's at least one dish (see MenuPreviewSection).
    // A friendly empty state reads better than a 404 for what is still a
    // real, existing restaurant listing.
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-16 text-center sm:py-24">
        <Link
          href={`/businesses/${business.slug}`}
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeftIcon aria-hidden className="h-4 w-4" />
          Back to {business.name}
        </Link>
        <h1 className="mt-4 font-display text-xl font-bold text-slate-950 dark:text-slate-50">Menu coming soon</h1>
        <p className="max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
          {business.name} hasn&apos;t added any dishes yet. Check back soon, or contact them directly for what&apos;s
          on offer today.
        </p>
      </main>
    );
  }

  return <RestaurantMenuOrdering business={business} items={items} />;
}
