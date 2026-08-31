import type { Ad, Advertisement, AdCtaType } from "./types";
import { whatsappLink } from "./contact";

export function advertisementToAd(ad: Advertisement): Ad {
  let ctaType: AdCtaType = "learn_more";
  let ctaUrl = `/ads/${ad.id}`;

  if (ad.contactWhatsapp) {
    ctaType = "message";
    ctaUrl = whatsappLink(ad.contactWhatsapp);
  } else if (ad.contactPhone) {
    ctaType = "call";
    ctaUrl = `tel:${ad.contactPhone}`;
  } else if (ad.externalLink) {
    ctaType = /apply|career|hiring|job/i.test(`${ad.title} ${ad.description}`)
      ? "apply"
      : "learn_more";
    ctaUrl = ad.externalLink;
  }

  return {
    id: ad.id,
    sponsorLabel: "Sponsored",
    image: ad.images[0] ?? null,
    title: ad.title,
    description: ad.description,
    ctaType,
    ctaUrl,
    advertiserName: ad.owner?.name ?? undefined,
  };
}
