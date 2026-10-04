import { notFound } from "next/navigation";
import { PharmacyStorefront } from "@/components/pharmacy/PharmacyStorefront";
import {
  getPharmacy,
  getPharmacyCategories,
  getPharmacyProducts,
} from "@/lib/pharmacy-api";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getPharmacy(slug).catch(() => null);
  if (!p) return { title: "Pharmacy — LIBERIA360" };
  return {
    title: `${p.name} — order medicines online | LIBERIA360`,
    description: `Order from ${p.name} in ${p.location}: pickup or delivery, pay with cash, MTN MoMo or Orange Money. A pharmacist checks every prescription.`,
  };
}

export default async function PharmacyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rx?: string }>;
}) {
  const { slug } = await params;
  const { rx } = await searchParams;
  const p = await getPharmacy(slug).catch(() => null);
  if (!p) notFound();
  const [products, categories] = await Promise.all([
    getPharmacyProducts(p.id),
    getPharmacyCategories(),
  ]);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
      <PharmacyStorefront
        pharmacy={p}
        products={products}
        categories={categories}
        prescriptionId={typeof rx === "string" ? rx : null}
      />
    </main>
  );
}
