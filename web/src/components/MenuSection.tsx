import { formatCost } from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";
import { SafeImage } from "@/components/SafeImage";
import type { MenuItem } from "@/lib/types";

// Groups a business's menu into its sections in the order the backend
// already returns them (category ASC, then sortOrder — see
// MenuItemsService.findForBusiness), with uncategorized items collected
// under "Menu" at the end rather than scattered by their null category.
function groupMenuByCategory(items: MenuItem[]): { category: string; items: MenuItem[] }[] {
  const groups: { category: string; items: MenuItem[] }[] = [];
  for (const item of items) {
    const category = item.category ?? "Menu";
    const group = groups.find((g) => g.category === category);
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ category, items: [item] });
    }
  }
  return groups;
}

function MenuItemRow({ item }: { item: MenuItem }) {
  const image = item.image ? resolveImageUrl(item.image) : null;
  return (
    <li className={`flex items-start gap-3 py-3 ${!item.isAvailable ? "opacity-60" : ""}`}>
      <SafeImage
        src={image}
        alt=""
        className="h-14 w-14 shrink-0 rounded-xl object-cover"
        fallback={
          <div aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">
            🍽️
          </div>
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-slate-900 dark:text-slate-50">{item.name}</p>
          <span className="shrink-0 font-semibold text-slate-900 dark:text-slate-50">{formatCost(item.price)}</span>
        </div>
        {item.description && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
        )}
        {!item.isAvailable && (
          <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Sold out
          </span>
        )}
      </div>
    </li>
  );
}

// Shared by both the Place page (a visitor's primary destination — where a
// restaurant's menu belongs, per the "menu is information about the place,
// not about the business entity" product decision) and the Business page
// (kept for anyone who lands there directly, e.g. via an old link). Neither
// page duplicates groupMenuByCategory/MenuItemRow anymore.
export function MenuSection({ items }: { items: MenuItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">What&apos;s on offer</p>
      <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Menu</h2>
      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {groupMenuByCategory(items).map((group) => (
          <div key={group.category} className="min-w-0">
            <h3 className="border-b border-slate-100 pb-2 font-display text-sm font-bold uppercase tracking-wide text-brand-700 dark:border-slate-800 dark:text-brand-300">
              {group.category}
            </h3>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {group.items.map((item) => (
                <MenuItemRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
