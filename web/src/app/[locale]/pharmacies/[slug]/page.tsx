import { PageHeader } from "@/components/PageHeader";
import { PharmacyShop } from "@/components/pharmacy/PharmacyShop";
import {
  getPharmacy,
  getPharmacyCategories,
  getPharmacyProducts,
} from "@/lib/pharmacy-api";
export default async function PharmacyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getPharmacy(slug);
  const [products, categories] = await Promise.all([
    getPharmacyProducts(p.id),
    getPharmacyCategories(),
  ]);
  return (
    <main className="page-shell max-w-6xl">
      <PageHeader
        eyebrow="Verified pharmacy"
        title={p.name}
        description={`${p.address}, ${p.location} · ${p.telephone}`}
      />
      <section className="rounded-2xl bg-brand-900 p-5 text-white">
        <h2 className="font-bold">Opening hours</h2>
        <p className="text-sm">
          {p.openingHours
            ?.map((h) =>
              h.isClosed
                ? "Closed"
                : `${h.opensAt?.slice(0, 5)}–${h.closesAt?.slice(0, 5)}`,
            )
            .join(" · ")}
        </p>
        <p className="mt-2 text-sm">
          {p.deliveryEnabled ? "Delivery available" : "Delivery unavailable"} ·{" "}
          {p.pickupEnabled ? "Pickup available" : "Pickup unavailable"}
        </p>
      </section>
      <PharmacyShop pharmacy={p} products={products} categories={categories} />
      <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Prescription approval can only be made by an authorized pharmacy
        employee, subject to local law. The platform does not provide diagnoses,
        dosage advice, substitutions, or medical-validity decisions.
      </aside>
    </main>
  );
}
