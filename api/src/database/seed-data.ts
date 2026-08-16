import {
  PlaceType,
  RecommendedVisitLength,
  VerificationStatus,
} from "../places/entities/place.enums";
import { ActivityDifficulty } from "../activities/entities/activity.enums";

/**
 * Seed data for local development and demos.
 *
 * Scope: Stage 1 only (Greater Monrovia — Montserrado & Margibi counties),
 * matching the geographic rollout in Business Plan §9.1.
 *
 * IMPORTANT — this is illustrative, not verified catalog content:
 *  - The historic/public sites (Providence Island, the National Museum,
 *    Ducor Hill, Waterside Market, ELWA Beach, CeeCee Beach, the Marshall
 *    wetlands) are real places, described in general terms. No contact
 *    info is attached to them here — that has to come from the real
 *    verification workflow (Tech Spec §7), not a seed script.
 *  - The hotel/restaurant/tour-operator entries are clearly-labeled
 *    placeholder businesses ("Example Placeholder ..."), not real
 *    companies. Their phone/WhatsApp numbers are obviously-fake
 *    (+231-000-...) so the contact-link UI has something to exercise in
 *    dev without anyone mistaking it for a real number.
 *  - Every seeded place is `verificationStatus: UNVERIFIED` — seed data
 *    should never claim a badge it hasn't earned.
 *
 * Building the real 100/100/100/50/50/30 Stage 1 catalog (Tech Spec §9.1)
 * is a content-collection task, not an engineering one.
 */

export interface CountySeed {
  name: string;
  slug: string;
  rolloutStage: number;
  // One symbol for what the county is locally known for — editorial, not
  // derived from anything else in the schema. Confidence varies: solid for
  // Montserrado/Margibi/Grand Cape Mount/Nimba; a reasonable best guess for
  // the rest, expected to get corrected over time rather than researched
  // to certainty up front.
  icon: string;
  // Safety & practical-info panel — only populated for counties actually
  // live in the catalog (rolloutStage 1). Deliberately no emergencyNumber
  // seeded here: it's the one field where a wrong value is actively
  // worse than an empty one, so it's left for an admin to verify and set
  // via PATCH /admin/counties/:id rather than asserted at seed time.
  // safetyTips/localCustoms below are general, low-risk-if-imprecise
  // travel-safety and etiquette notes, not anything safety-critical.
  safetyTips?: string[];
  localCustoms?: string;
}

// All 15 counties, staged per Business Plan §9.1.
export const COUNTY_SEEDS: CountySeed[] = [
  {
    name: "Montserrado",
    slug: "montserrado",
    rolloutStage: 1,
    icon: "🏛️", // the capital county — Monrovia
    safetyTips: [
      "Agree on the fare before getting into a shared taxi — meters aren't standard.",
      "Carry small-denomination cash (USD and Liberian dollars are both widely used); many small vendors can't take cards.",
      "Stick to bottled or filtered water.",
      "Traffic drives on the right; road conditions and lighting vary a lot after dark, so plan evening travel in advance.",
    ],
    localCustoms:
      "A warm, unhurried greeting before getting to business is the norm. Dress modestly when visiting religious or cultural sites. Tipping isn't obligatory but is appreciated for guides and service staff.",
  },
  {
    name: "Margibi",
    slug: "margibi",
    rolloutStage: 1,
    icon: "✈️", // Roberts International Airport
    safetyTips: [
      "Roberts International Airport is well outside central Monrovia — budget real transfer time, especially at night.",
      "Agree on the fare before getting into a shared taxi — meters aren't standard.",
      "Stick to bottled or filtered water.",
    ],
    localCustoms:
      "Same general etiquette as Montserrado — a warm greeting first, modest dress at religious/cultural sites, cash widely preferred over cards outside larger hotels.",
  },
  { name: "Bong", slug: "bong", rolloutStage: 2, icon: "🎓" }, // Cuttington University, Gbarnga
  { name: "Grand Bassa", slug: "grand-bassa", rolloutStage: 2, icon: "⚓" }, // Buchanan — Liberia's 2nd-largest port
  {
    name: "Grand Cape Mount",
    slug: "grand-cape-mount",
    rolloutStage: 2,
    icon: "🏄",
  }, // Robertsport — internationally known surf spot
  { name: "Nimba", slug: "nimba", rolloutStage: 3, icon: "⛰️" }, // Mount Nimba, Liberia's highest peak; iron ore
  { name: "Sinoe", slug: "sinoe", rolloutStage: 3, icon: "🌳" }, // Sapo National Park — largest rainforest reserve
  { name: "Maryland", slug: "maryland", rolloutStage: 3, icon: "🗼" }, // Cape Palmas Lighthouse, historic Harper
  { name: "Grand Kru", slug: "grand-kru", rolloutStage: 3, icon: "⛵" }, // Kru people — historically famed West African seafarers
  { name: "Bomi", slug: "bomi", rolloutStage: 4, icon: "⛏️" }, // Tubmanburg / Bomi Hills — early iron-ore mining
  { name: "Gbarpolu", slug: "gbarpolu", rolloutStage: 4, icon: "💎" }, // artisanal gold/diamond mining
  { name: "Grand Gedeh", slug: "grand-gedeh", rolloutStage: 4, icon: "🌲" }, // dense forest, Zwedru
  { name: "Lofa", slug: "lofa", rolloutStage: 4, icon: "☕" }, // coffee/cocoa, Liberia's agricultural heartland
  { name: "River Cess", slug: "river-cess", rolloutStage: 4, icon: "🌴" }, // palm oil, rural rainforest
  { name: "River Gee", slug: "river-gee", rolloutStage: 4, icon: "🌊" }, // newest county, coastal/forest border area
];

export interface CategorySeed {
  name: string;
  slug: string;
  icon: string;
  description: string;
}

export const CATEGORY_SEEDS: CategorySeed[] = [
  {
    name: "Beaches",
    slug: "beaches",
    icon: "🏖️",
    description: "Coastal spots for swimming, surfing, and sunsets.",
  },
  {
    name: "Waterfalls & Nature",
    slug: "waterfalls-nature",
    icon: "💧",
    description: "Waterfalls, rivers, and rainforest.",
  },
  {
    name: "Hiking & Adventure",
    slug: "hiking-adventure",
    icon: "🥾",
    description: "Trails, hikes, and outdoor activity.",
  },
  {
    name: "Culture & Heritage",
    slug: "culture-heritage",
    icon: "🏛️",
    description: "Historic sites, museums, and cultural landmarks.",
  },
  {
    name: "Food & Dining",
    slug: "food-dining",
    icon: "🍽️",
    description: "Restaurants, street food, cafés, and bars.",
  },
  {
    name: "Nightlife",
    slug: "nightlife",
    icon: "🌙",
    description: "Bars, live music, and after-dark spots.",
  },
  {
    name: "Wildlife & Eco-Tourism",
    slug: "wildlife-eco-tourism",
    icon: "🦎",
    description: "Wetlands, wildlife, and eco-tourism sites.",
  },
  {
    name: "Hotels & Lodges",
    slug: "hotels-lodges",
    icon: "🏨",
    description: "Places to stay, from guesthouses to resorts.",
  },
  {
    name: "City & Shopping",
    slug: "city-shopping",
    icon: "🛍️",
    description: "Markets, city life, and shopping districts.",
  },
  {
    name: "Islands & Boat Trips",
    slug: "islands-boat-trips",
    icon: "🛶",
    description: "Island visits and river/boat excursions.",
  },
];

export interface ActivitySeed {
  name: string;
  description: string;
  duration: string;
  price: number | null;
  difficulty: ActivityDifficulty | null;
  ageRange: string;
  guideRequired: boolean;
}

export interface PlaceSeed {
  name: string;
  slug: string;
  description: string;
  type: PlaceType;
  categorySlug: string;
  tags: string[];
  countySlug: string;
  city: string;
  latitude: number;
  longitude: number;
  distanceFromMonroviaKm: number;
  recommendedVisitLength: RecommendedVisitLength;
  estimatedCostEntry: number | null;
  estimatedCostGuide: number | null;
  estimatedCostTransport: number | null;
  contactPhone: string | null;
  whatsapp: string | null;
  verificationStatus: VerificationStatus;
  activities?: ActivitySeed[];
}

export const PLACE_SEEDS: PlaceSeed[] = [
  {
    name: "Providence Island",
    slug: "providence-island",
    description:
      "A small island at the mouth of the Mesurado River in central Monrovia, recognized as the landing site of the first freed-slave settlers in 1822. A short, walkable historic site with river and city views.",
    type: PlaceType.ATTRACTION,
    categorySlug: "culture-heritage",
    tags: ["history", "landmark", "walkable"],
    countySlug: "montserrado",
    city: "Monrovia",
    latitude: 6.3167,
    longitude: -10.8022,
    distanceFromMonroviaKm: 0,
    recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
    estimatedCostEntry: 0,
    estimatedCostGuide: null,
    estimatedCostTransport: 0,
    contactPhone: null,
    whatsapp: null,
    verificationStatus: VerificationStatus.UNVERIFIED,
  },
  {
    name: "National Museum of Liberia",
    slug: "national-museum-of-liberia",
    description:
      "Liberia's national museum, holding cultural, historical, and archaeological collections that trace the country's history and its many ethnic traditions.",
    type: PlaceType.ATTRACTION,
    categorySlug: "culture-heritage",
    tags: ["museum", "history", "indoor"],
    countySlug: "montserrado",
    city: "Monrovia",
    latitude: 6.3009,
    longitude: -10.7975,
    distanceFromMonroviaKm: 1,
    recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
    estimatedCostEntry: 5,
    estimatedCostGuide: null,
    estimatedCostTransport: 0,
    contactPhone: null,
    whatsapp: null,
    verificationStatus: VerificationStatus.UNVERIFIED,
  },
  {
    name: "Ducor Hill",
    slug: "ducor-hill",
    description:
      "The hilltop site of the former Ducor Intercontinental Hotel, Monrovia's highest point and best free panoramic view over the city and the Atlantic coastline.",
    type: PlaceType.ATTRACTION,
    categorySlug: "culture-heritage",
    tags: ["viewpoint", "landmark", "photography"],
    countySlug: "montserrado",
    city: "Monrovia",
    latitude: 6.3181,
    longitude: -10.8047,
    distanceFromMonroviaKm: 1,
    recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
    estimatedCostEntry: 0,
    estimatedCostGuide: null,
    estimatedCostTransport: 0,
    contactPhone: null,
    whatsapp: null,
    verificationStatus: VerificationStatus.UNVERIFIED,
  },
  {
    name: "ELWA Beach",
    slug: "elwa-beach",
    description:
      "A wide, popular Monrovia beach near the ELWA junction, known for surf breaks and as a weekend gathering spot for locals and expats alike.",
    type: PlaceType.NATURE_SITE,
    categorySlug: "beaches",
    tags: ["surfing", "swimming", "weekend"],
    countySlug: "montserrado",
    city: "Paynesville",
    latitude: 6.2011,
    longitude: -10.7361,
    distanceFromMonroviaKm: 12,
    recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
    estimatedCostEntry: 0,
    estimatedCostGuide: null,
    estimatedCostTransport: 5,
    contactPhone: null,
    whatsapp: null,
    verificationStatus: VerificationStatus.UNVERIFIED,
    activities: [
      {
        name: "Beginner surf lesson",
        description:
          "Board and basic instruction with a local surf instructor.",
        duration: "1.5 hours",
        price: 25,
        difficulty: ActivityDifficulty.EASY,
        ageRange: "All ages",
        guideRequired: true,
      },
    ],
  },
  {
    name: "CeeCee Beach",
    slug: "ceecee-beach",
    description:
      "A calmer, more sheltered beach near Mamba Point in central Monrovia, popular for swimming, food stalls, and sunset views over the Atlantic.",
    type: PlaceType.NATURE_SITE,
    categorySlug: "beaches",
    tags: ["swimming", "sunset", "family-friendly"],
    countySlug: "montserrado",
    city: "Monrovia",
    latitude: 6.3128,
    longitude: -10.8087,
    distanceFromMonroviaKm: 2,
    recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
    estimatedCostEntry: 0,
    estimatedCostGuide: null,
    estimatedCostTransport: 2,
    contactPhone: null,
    whatsapp: null,
    verificationStatus: VerificationStatus.UNVERIFIED,
  },
  {
    name: "Waterside Market",
    slug: "waterside-market",
    description:
      "One of Monrovia's largest and busiest open-air markets, on the Mesurado River waterfront — textiles, produce, household goods, and street food in a dense, energetic setting.",
    type: PlaceType.ATTRACTION,
    categorySlug: "city-shopping",
    tags: ["market", "shopping", "street-food"],
    countySlug: "montserrado",
    city: "Monrovia",
    latitude: 6.3197,
    longitude: -10.8003,
    distanceFromMonroviaKm: 1,
    recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
    estimatedCostEntry: 0,
    estimatedCostGuide: null,
    estimatedCostTransport: 0,
    contactPhone: null,
    whatsapp: null,
    verificationStatus: VerificationStatus.UNVERIFIED,
  },
  {
    name: "Marshall Wetlands",
    slug: "marshall-wetlands",
    description:
      "Mangrove wetlands around the Farmington River estuary near Marshall — a fishing community with boat access into the mangroves and coastal birdlife.",
    type: PlaceType.NATURE_SITE,
    categorySlug: "wildlife-eco-tourism",
    tags: ["mangroves", "birdwatching", "boat-trip"],
    countySlug: "margibi",
    city: "Marshall",
    latitude: 6.1494,
    longitude: -10.3703,
    distanceFromMonroviaKm: 43,
    recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
    estimatedCostEntry: 0,
    estimatedCostGuide: 15,
    estimatedCostTransport: 20,
    contactPhone: null,
    whatsapp: null,
    verificationStatus: VerificationStatus.UNVERIFIED,
    activities: [
      {
        name: "Mangrove canoe trip",
        description:
          "Guided canoe trip through the mangrove channels with a local fisherman guide.",
        duration: "2 hours",
        price: 20,
        difficulty: ActivityDifficulty.EASY,
        ageRange: "All ages",
        guideRequired: true,
      },
    ],
  },
  {
    name: "Example Placeholder Lodge — Sinkor",
    slug: "example-placeholder-lodge-sinkor",
    description:
      "PLACEHOLDER SEED RECORD for local development — not a real business. Demonstrates a hotel listing with room-adjacent contact details in the destination profile template.",
    type: PlaceType.HOTEL,
    categorySlug: "hotels-lodges",
    tags: ["seed-data", "placeholder"],
    countySlug: "montserrado",
    city: "Monrovia",
    latitude: 6.284,
    longitude: -10.7599,
    distanceFromMonroviaKm: 4,
    recommendedVisitLength: RecommendedVisitLength.OVERNIGHT,
    estimatedCostEntry: null,
    estimatedCostGuide: null,
    estimatedCostTransport: null,
    contactPhone: "+231-000-000-0001",
    whatsapp: "+231-000-000-0001",
    verificationStatus: VerificationStatus.UNVERIFIED,
  },
  {
    name: "Example Placeholder Grill — Congo Town",
    slug: "example-placeholder-grill-congo-town",
    description:
      "PLACEHOLDER SEED RECORD for local development — not a real business. Demonstrates a restaurant listing.",
    type: PlaceType.RESTAURANT,
    categorySlug: "food-dining",
    tags: ["seed-data", "placeholder"],
    countySlug: "montserrado",
    city: "Monrovia",
    latitude: 6.2803,
    longitude: -10.7469,
    distanceFromMonroviaKm: 6,
    recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
    estimatedCostEntry: null,
    estimatedCostGuide: null,
    estimatedCostTransport: null,
    contactPhone: "+231-000-000-0002",
    whatsapp: "+231-000-000-0002",
    verificationStatus: VerificationStatus.UNVERIFIED,
  },
  {
    name: "Example Placeholder Tours — Paynesville",
    slug: "example-placeholder-tours-paynesville",
    description:
      "PLACEHOLDER SEED RECORD for local development — not a real business. Demonstrates an activity-provider listing with bookable/requestable activities attached.",
    type: PlaceType.ACTIVITY_PROVIDER,
    categorySlug: "hiking-adventure",
    tags: ["seed-data", "placeholder"],
    countySlug: "montserrado",
    city: "Paynesville",
    latitude: 6.2833,
    longitude: -10.735,
    distanceFromMonroviaKm: 10,
    recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
    estimatedCostEntry: null,
    estimatedCostGuide: null,
    estimatedCostTransport: null,
    contactPhone: "+231-000-000-0003",
    whatsapp: "+231-000-000-0003",
    verificationStatus: VerificationStatus.UNVERIFIED,
    activities: [
      {
        name: "Monrovia half-day city walking tour",
        description:
          "Guided walk covering Providence Island, Waterside Market, and Ducor Hill.",
        duration: "4 hours",
        price: 30,
        difficulty: ActivityDifficulty.EASY,
        ageRange: "All ages",
        guideRequired: true,
      },
    ],
  },
];
