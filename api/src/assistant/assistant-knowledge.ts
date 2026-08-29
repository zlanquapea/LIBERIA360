export interface AssistantAction {
  id: string;
  label: string;
  href: string;
}

export interface AssistantKnowledgeEntry {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  actionIds: string[];
  followUps: string[];
}

export const ASSISTANT_ACTIONS: Record<string, AssistantAction> = {
  home: { id: "home", label: "Go to Home", href: "/" },
  search: { id: "search", label: "Search Liberia", href: "/search" },
  counties: { id: "counties", label: "Browse counties", href: "/counties" },
  nearMe: { id: "nearMe", label: "Explore Near Me", href: "/near-me" },
  map: { id: "map", label: "Open map", href: "/explore" },
  addPlace: { id: "addPlace", label: "Add a place", href: "/places/submit" },
  account: { id: "account", label: "Open account", href: "/account" },
  myPlaces: {
    id: "myPlaces",
    label: "Manage my places",
    href: "/account/my-places",
  },
  ads: { id: "ads", label: "Manage my ads", href: "/account/my-ads" },
  bookings: {
    id: "bookings",
    label: "View bookings",
    href: "/account/bookings",
  },
  creators: { id: "creators", label: "Explore creators", href: "/creators" },
  creatorProfile: {
    id: "creatorProfile",
    label: "Open creator profile",
    href: "/creators/me",
  },
  createPost: {
    id: "createPost",
    label: "Create a post",
    href: "/creators/me/create",
  },
  events: { id: "events", label: "Explore events", href: "/events" },
  addEvent: { id: "addEvent", label: "Add an event", href: "/events/new" },
  trips: { id: "trips", label: "Plan a trip", href: "/trips/new" },
  weekend: {
    id: "weekend",
    label: "Plan a weekend",
    href: "/trips/weekend/new",
  },
  saved: { id: "saved", label: "View saved places", href: "/saved" },
  notifications: {
    id: "notifications",
    label: "View notifications",
    href: "/notifications",
  },
  signup: { id: "signup", label: "Create an account", href: "/signup" },
  login: { id: "login", label: "Log in", href: "/login" },
};

export const ASSISTANT_KNOWLEDGE: AssistantKnowledgeEntry[] = [
  {
    id: "overview",
    title: "What LIBERIA360 is",
    keywords: [
      "what is liberia360",
      "about",
      "app",
      "website",
      "platform",
      "what can i do",
      "features",
      "help",
    ],
    answer:
      "LIBERIA360 helps people discover places, businesses, events, trips, and local creators across Liberia. You can search by county or category, read reviews, save places, request bookings, follow creators, add a business or place, and advertise to reach more people.",
    actionIds: ["search", "creators", "events"],
    followUps: ["How do I add my business?", "How does advertising work?"],
  },
  {
    id: "discover",
    title: "Search and discover Liberia",
    keywords: [
      "find",
      "search",
      "discover",
      "place",
      "places",
      "business",
      "restaurant",
      "hotel",
      "county",
      "category",
      "near me",
      "map",
    ],
    answer:
      "Use Search to find places and businesses by name, county, or category. You can also browse all 15 counties, use Near Me for nearby places, or open the map to explore Liberia visually.",
    actionIds: ["search", "counties", "map"],
    followUps: ["How do I save a place?", "How do reviews work?"],
  },
  {
    id: "add-business",
    title: "Add and manage a business or place",
    keywords: [
      "add my business",
      "add business",
      "list business",
      "register business",
      "submit place",
      "add place",
      "my place",
      "claim business",
      "business owner",
    ],
    answer:
      "To add your business, log in and open Add a place. Enter the business name, category, county, location, contact details, description, and photos. Submit it for review. After approval, you can manage it from My Places in your account.",
    actionIds: ["addPlace", "myPlaces", "login"],
    followUps: [
      "How long does approval take?",
      "How can I advertise my business?",
    ],
  },
  {
    id: "advertising",
    title: "Advertise a business",
    keywords: [
      "advertise",
      "advertising",
      "ad",
      "ads",
      "sponsored",
      "promote",
      "promotion",
      "reach customers",
      "market business",
    ],
    answer:
      "Go to Account, open My Ads, and choose New ad. Add your title, description, image or flyer, contact information, and link, then submit it for review. Approved ads can appear in the Sponsored section. You can edit, delete, and view ad performance from My Ads. Online ad payment and public pricing are not available yet.",
    actionIds: ["ads", "account"],
    followUps: [
      "What information does an ad need?",
      "Where will my ad appear?",
    ],
  },
  {
    id: "bookings",
    title: "Request and manage bookings",
    keywords: [
      "book",
      "booking",
      "reservation",
      "request booking",
      "book creator",
      "book service",
      "appointment",
    ],
    answer:
      "Open a business or creator profile and use its booking option when available. Enter the requested details and send the request. The owner can review and respond, and both sides can follow the booking from the account area.",
    actionIds: ["bookings", "search", "creators"],
    followUps: [
      "How do creators receive bookings?",
      "Where are my booking messages?",
    ],
  },
  {
    id: "become-creator",
    title: "Become a creator",
    keywords: [
      "become a creator",
      "become creator",
      "join creators",
      "start creator profile",
      "apply as creator",
      "creator account",
    ],
    answer:
      "Log in and open the Creator dashboard, then complete the Become a creator form with your name, username, creator category, contact information, services, experience, locations, and profile details. After saving the profile, you can add portfolio work, create posts, and receive booking requests.",
    actionIds: ["creatorProfile", "login"],
    followUps: ["How do I create a post?", "How do creator bookings work?"],
  },
  {
    id: "creators",
    title: "Creators and the creator community",
    keywords: [
      "creator",
      "creators",
      "creator community",
      "follow creator",
      "local storyteller",
      "content creator",
    ],
    answer:
      "The Creators area helps people discover Liberian storytellers and their text, photo, and video posts. Users can follow creators, like posts, comment, reply to comments, share, save posts, and request bookings from creator profiles when available.",
    actionIds: ["creators", "creatorProfile"],
    followUps: ["How do I become a creator?", "How do I create a post?"],
  },
  {
    id: "creator-posts",
    title: "Create and manage creator posts",
    keywords: [
      "create post",
      "post video",
      "post photo",
      "text post",
      "edit post",
      "delete post",
      "caption",
      "creator post",
    ],
    answer:
      "Creators can publish text, photo, or video posts from the Create post page. Add a caption, preview the media, and publish. A creator can use the three-dot menu on their own post to edit it or confirm deletion.",
    actionIds: ["createPost", "creatorProfile"],
    followUps: [
      "How do comments and replies work?",
      "How do I change my creator photo?",
    ],
  },
  {
    id: "creator-profile-photos",
    title: "Creator profile and cover photos",
    keywords: [
      "profile photo",
      "cover photo",
      "upload creator photo",
      "delete photo",
      "crop photo",
      "creator profile picture",
    ],
    answer:
      "On your creator profile, open the photo action menu to view, upload, or delete your profile or cover photo. Before upload, you can preview the crop and adjust zoom and position. Visitors can view these photos but cannot manage them.",
    actionIds: ["creatorProfile"],
    followUps: ["How do I create a post?", "How do creator bookings work?"],
  },
  {
    id: "engagement",
    title: "Likes, comments, replies, sharing, and saving",
    keywords: [
      "like",
      "comment",
      "reply",
      "share",
      "save post",
      "unsave",
      "bookmark",
      "engagement",
    ],
    answer:
      "On creator posts, signed-in users can like, comment, reply to comments, share, and save. Save creates a private bookmark and changes to Unsave when active. Saved creator posts are stored, but the current Saved page mainly displays saved places, so a full saved-creator-posts list is still a planned improvement.",
    actionIds: ["creators", "saved", "login"],
    followUps: ["Where can I find creators?", "How do I follow a creator?"],
  },
  {
    id: "events",
    title: "Find and add events",
    keywords: [
      "event",
      "events",
      "happening",
      "add event",
      "submit event",
      "rsvp",
    ],
    answer:
      "Use Events to see what is happening in Liberia. Open an event for its date, location, and details. Signed-in users can also use Add an event to submit an event for the platform.",
    actionIds: ["events", "addEvent"],
    followUps: ["How do I plan a trip?", "How do I find places by county?"],
  },
  {
    id: "trips",
    title: "Plan a Liberia trip",
    keywords: [
      "trip",
      "trips",
      "travel plan",
      "itinerary",
      "weekend",
      "plan route",
      "vacation",
    ],
    answer:
      "Use the trip planner to choose your days, interests, and budget, then build a Liberia route. There is also a quick weekend planner for places to stay, eat, and explore.",
    actionIds: ["trips", "weekend"],
    followUps: ["How do I find hotels?", "How do I explore counties?"],
  },
  {
    id: "reviews-verification",
    title: "Reviews and business badges",
    keywords: [
      "review",
      "reviews",
      "rating",
      "verified",
      "verification",
      "recommended",
      "badge",
      "trust",
    ],
    answer:
      "Reviews help people share real experiences with places and businesses. Verification and recommendation badges are managed by LIBERIA360 administrators after review; business owners cannot add these badges to themselves.",
    actionIds: ["search", "account"],
    followUps: [
      "How do I add my business?",
      "How do I report wrong information?",
    ],
  },
  {
    id: "saved-account",
    title: "Saved places, account, and notifications",
    keywords: [
      "saved",
      "favorites",
      "bookmark place",
      "account",
      "profile",
      "notification",
      "notifications",
      "login",
      "sign up",
    ],
    answer:
      "Create an account or log in to save places, manage listings and ads, view bookings, receive notifications, and use creator features. Saved places are available from the Saved area, and alerts appear under Notifications.",
    actionIds: ["account", "saved", "notifications"],
    followUps: ["How do I create an account?", "How do I add my business?"],
  },
  {
    id: "support-safety",
    title: "Support, safety, and reports",
    keywords: [
      "support",
      "problem",
      "wrong information",
      "report",
      "unsafe",
      "password",
      "payment",
      "help me",
      "contact team",
    ],
    answer:
      "For incorrect or unsafe content, use the available report option on that item. Never share your password, verification code, or payment credentials in chat. The assistant can explain steps and open pages, but it cannot approve listings, verify businesses, publish, delete, pay, or submit sensitive actions for you.",
    actionIds: ["account", "home"],
    followUps: ["How do verification badges work?", "What can LIBERIA360 do?"],
  },
];

export const ASSISTANT_QUICK_PROMPTS = [
  "What can I do on LIBERIA360?",
  "How do I add my business?",
  "How does advertising work?",
  "How do bookings work?",
  "How do I become a creator?",
];

export const ASSISTANT_KNOWLEDGE_TEXT = ASSISTANT_KNOWLEDGE.map(
  (entry) =>
    `${entry.id} | ${entry.title}\n${entry.answer}\nAllowed actions: ${entry.actionIds.join(", ")}`,
).join("\n\n");
