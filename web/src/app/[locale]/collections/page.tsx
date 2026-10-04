import Link from "next/link";
import { CollectionsManager } from "@/components/CollectionsManager";
export const metadata = { title: "Collections — LIBERIA360" };
export default function CollectionsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-28">
      <Link
        href="/saved"
        className="text-sm font-semibold text-brand-700 dark:text-emerald-300"
      >
        ← Saved items
      </Link>
      <h1 className="mb-6 mt-4 text-3xl font-bold">Your collections</h1>
      <CollectionsManager />
    </main>
  );
}
