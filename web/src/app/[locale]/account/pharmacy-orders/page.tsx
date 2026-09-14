"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Pharmacy orders no longer get their own dedicated account page — an
// order is an order, so /account/my-orders now covers food and pharmacy
// orders alike (see that page's own doc comment). This route stays in
// place only as a redirect, so an old bookmark or a stale link (this file
// used to be linked from the account page's tile grid) still lands
// somewhere useful instead of 404ing.
export default function PharmacyOrdersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/account/my-orders");
  }, [router]);
  return null;
}
