import { PageHeader } from "@/components/PageHeader";
import { PharmacyCard } from "@/components/pharmacy/PharmacyCard";
import { PharmacyMapLoader } from "@/components/pharmacy/PharmacyMapLoader";
import { getPharmacies } from "@/lib/pharmacy-api";
export const metadata = { title: "Pharmacies — LIBERIA360" };
type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;
export default async function PharmaciesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const s = await searchParams,
    p = new URLSearchParams();
  for (const k of ["search", "location", "openNow", "delivery", "pickup"]) {
    const v = first(s[k]);
    if (v) p.set(k, v);
  }
  const pharmacies = await getPharmacies(p);
  const map = first(s.view) === "map";
  return (
    <main className="page-shell max-w-6xl">
      <PageHeader
        eyebrow="Health essentials"
        title="Pharmacy marketplace"
        description="Find verified local pharmacies and request permitted products for pickup or delivery."
      />
      <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        For a medical emergency, contact your local emergency services.
        LIBERIA360 is a marketplace, not a pharmacy or healthcare provider.
      </aside>
      <form className="grid gap-3 rounded-2xl border bg-white p-4 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5">
        <label className="lg:col-span-2">
          Search pharmacies
          <input
            name="search"
            defaultValue={first(s.search)}
            placeholder="Name or address"
            className="input mt-1 w-full"
          />
        </label>
        <label>
          Location
          <input
            name="location"
            defaultValue={first(s.location)}
            placeholder="City or county"
            className="input mt-1 w-full"
          />
        </label>
        <div className="flex flex-col gap-2 text-sm">
          {[
            ["openNow", "Open now"],
            ["delivery", "Delivery available"],
            ["pickup", "Pickup available"],
          ].map(([n, l]) => (
            <label key={n}>
              <input
                type="checkbox"
                name={n}
                value="true"
                defaultChecked={first(s[n]) === "true"}
              />{" "}
              {l}
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <button className="btn-primary min-h-11">Apply filters</button>
          <div className="flex gap-2">
            <a href="?view=list" className="text-sm underline">
              List
            </a>
            <a href={`?${p}&view=map`} className="text-sm underline">
              Map
            </a>
          </div>
        </div>
      </form>
      {!pharmacies.length ? (
        <p className="empty-state">No verified pharmacies match your search.</p>
      ) : map ? (
        <PharmacyMapLoader pharmacies={pharmacies} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pharmacies.map((x) => (
            <PharmacyCard key={x.id} pharmacy={x} />
          ))}
        </div>
      )}
    </main>
  );
}
