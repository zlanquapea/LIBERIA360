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
  support: { id: "support", label: "Contact customer support", href: "/account/support" },
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
  carRentals: {
    id: "carRentals",
    label: "Browse car rentals",
    href: "/car-rentals",
  },
  myCarListings: {
    id: "myCarListings",
    label: "Manage my car listings",
    href: "/account/my-car-listings",
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
  myTickets: {
    id: "myTickets",
    label: "View my tickets",
    href: "/account/my-tickets",
  },
  myEvents: {
    id: "myEvents",
    label: "Manage my events",
    href: "/account/my-events",
  },
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
      "LIBERIA360 helps people discover places, businesses, events, trips, and local creators across Liberia. You can search by county or category, read reviews, save places, request bookings, follow creators, add a business or place, advertise to reach more people, and buy tickets for approved paid events.",
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
    id: "approval-time",
    title: "Listing approval time and status",
    keywords: [
      "how long approval take",
      "how long does approval take",
      "approval time",
      "waiting for approval",
      "pending approval",
      "when will my business be approved",
      "listing review time",
    ],
    answer:
      "LIBERIA360 does not currently publish a guaranteed approval time. Your business or place must be reviewed before it appears publicly. Check My Places in your account for its current status. Please do not submit the same listing repeatedly while it is being reviewed.",
    actionIds: ["myPlaces", "account", "addPlace"],
    followUps: [
      "How do I add my business?",
      "How can I advertise my business?",
    ],
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
    id: "ad-placement",
    title: "Where advertisements appear",
    keywords: [
      "where will my ad appear",
      "where does my ad appear",
      "where are ads shown",
      "ad placement",
      "advertising placement",
      "sponsored section",
    ],
    answer:
      "Approved ads can appear in the Sponsored section on the LIBERIA360 homepage. Visibility depends on the ad being approved and available sponsored placement. You can manage your campaign from Account → My Ads.",
    actionIds: ["ads", "home"],
    followUps: [
      "How can I advertise my business?",
      "What information does an ad need?",
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
    id: "creator-booking-receiving",
    title: "How creators receive bookings",
    keywords: [
      "how do creators receive bookings",
      "how do creator bookings work",
      "how does a creator receive a booking",
      "creator booking request",
      "booking requests for creators",
      "people book me",
    ],
    answer:
      "When someone sends a booking request from your creator profile, you can review it in the Bookings area of your account. Open the request to review the customer’s details and respond. Keep checking your account for new requests and updates.",
    actionIds: ["bookings", "creatorProfile", "account"],
    followUps: ["Where are my booking messages?", "How do I become a creator?"],
  },
  {
    id: "booking-messages",
    title: "Find booking messages and requests",
    keywords: [
      "where are my booking messages",
      "where is my booking message",
      "find booking messages",
      "see booking requests",
      "booking inbox",
      "booking notifications",
    ],
    answer:
      "Open your account and go to Bookings to view your booking requests and related updates. If you are a creator, this is where you can review requests from people who want to book you.",
    actionIds: ["bookings", "account"],
    followUps: ["How do creators receive bookings?", "How do bookings work?"],
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
    id: "car-rental-rent",
    title: "How to rent a car",
    keywords: [
      "how do i rent a car",
      "how can i rent a car",
      "how to rent a car",
      "rent a car",
      "renting a car",
      "book a rental car",
      "hire a car",
    ],
    answer:
      "To rent a car, open Car Rentals and choose an approved vehicle that fits your county, category, transmission, seats, price, and driver needs. Open the listing to review its photos, specifications, price, deposit, pickup information, owner contact details, and reviews. Select Request to book, choose your rental date or supported hourly time range, add a driver if offered, and enter an optional pickup location and message. You must be signed in. This sends a request to the owner rather than creating an instant booking, and no payment is taken at the time of the request. The owner confirms or declines, and you can track the request in My Bookings.",
    actionIds: ["carRentals", "bookings"],
    followUps: [
      "Can I rent a car by the hour?",
      "Can I rent a car with a driver?",
    ],
  },
  {
    id: "car-rental-hourly",
    title: "Hourly car rentals",
    keywords: [
      "rent a car by the hour",
      "rent car by hour",
      "hourly car rental",
      "hourly rental",
      "by the hour",
      "by hour",
      "hour rental",
      "short rental",
    ],
    answer:
      "Yes, hourly rental is available when a vehicle listing provides an hourly rate. On that listing, choose By hour, select a date, enter a start time and end time on the same day, and review the estimated total. The listing may also specify minimum rental hours and an additional hourly driver fee. Then send a request to the owner. It is a request rather than an instant booking, and no payment is taken at that time.",
    actionIds: ["carRentals", "bookings"],
    followUps: ["How do I rent a car?", "Can I rent a car with a driver?"],
  },
  {
    id: "car-rental-driver",
    title: "Renting with a driver",
    keywords: [
      "rent a car with a driver",
      "car with driver",
      "rental with driver",
      "hire a driver",
      "add a driver",
      "rent without a driver",
      "car without driver",
    ],
    answer:
      "Some car listings offer a driver option. On a listing that supports it, select Add a driver when you request the rental. The listing may show an additional driver fee per day or per hour, depending on whether you rent by day or by hour. If the option is not shown, that vehicle does not currently advertise driver availability through LIBERIA360.",
    actionIds: ["carRentals"],
    followUps: ["How do I rent a car?", "Can I rent a car by the hour?"],
  },
  {
    id: "car-rental-list",
    title: "How to list a car",
    keywords: [
      "how do i list my car",
      "how can i list my car",
      "how to list a car",
      "list my vehicle",
      "list a vehicle",
      "rent out my car",
      "rent out my vehicle",
      "add my car",
    ],
    answer:
      "To list a car, sign in and open My Car Listings. Create a listing with the county, make, model, year, category, transmission, fuel type, seats, price, vehicle details, pickup location, contact information, and photos. You can also add driver fees, a security deposit, minimum rental days or hours, features, and an optional hourly rate. You do not need a business or claimed place. Submit the listing for review; it becomes publicly available only after approval.",
    actionIds: ["myCarListings", "login"],
    followUps: [
      "Do I need a business to list a car?",
      "How do car rentals work?",
    ],
  },
  {
    id: "car-rentals",
    title: "Browse, list, and rent cars",
    keywords: [
      "car rental",
      "car rentals",
      "rent a car",
      "rental car",
      "rent vehicle",
      "vehicle rental",
      "hire a car",
      "car hire",
      "renting a car",
      "rental vehicle",
      "car listing",
      "list my car",
      "list a car",
      "rent out my car",
      "car owner",
      "with driver",
      "without driver",
      "by day",
      "by hour",
      "hourly rental",
      "daily rental",
      "pickup location",
      "security deposit",
    ],
    answer:
      "LIBERIA360 Car Rentals is a peer-to-peer marketplace where signed-in users can list vehicles and travelers can browse approved, active cars by county, category, transmission, seats, price, and driver availability. You do not need a business or claimed place to list a car. Open Car Rentals to view a vehicle’s photos, specifications, pricing, deposit, pickup information, owner contact details, and reviews. When a listing supports it, you can request a rental by day or by hour, choose whether to add a driver, and provide a pickup location. A rental sends a request to the owner rather than creating an instant booking, and no payment is taken at the time of the request. The owner confirms or declines, and you can track the request in My Bookings.",
    actionIds: ["carRentals", "bookings", "myCarListings"],
    followUps: [
      "How do I rent a car?",
      "How do I list my car?",
      "Can I rent a car by the hour?",
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
      "profile picture",
      "cover image",
      "creator photo",
      "change creator photo",
      "change profile picture",
      "update creator photo",
      "replace creator image",
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
    id: "comment-interactions",
    title: "Comment likes and replies",
    keywords: [
      "like comment",
      "comment like",
      "reply to comment",
      "reply comment",
      "respond to comment",
      "comment reply",
      "comments and replies",
    ],
    answer:
      "On a creator post, sign in and open the comments. Tap Like on a comment to add or remove your like. Tap Reply to write a response under that comment. Your reply appears nested under the original comment. You can like comments and replies, but you must be signed in to interact.",
    actionIds: ["creators", "login"],
    followUps: [
      "How do I create a creator post?",
      "How do I follow a creator?",
    ],
  },
  {
    id: "save-creator-post",
    title: "Save a creator post",
    keywords: [
      "save creator post",
      "save a post",
      "bookmark creator post",
      "saved creator post",
      "where are saved posts",
      "unsave creator post",
    ],
    answer:
      "Tap Save at the bottom of a creator post to keep a private bookmark. The button changes to Unsave when it is active. Tap Unsave to remove it. You must be signed in. Saved creator posts are stored, but the current Saved page mainly shows saved places; a dedicated saved-creator-posts list is planned.",
    actionIds: ["creators", "saved", "login"],
    followUps: [
      "How do I like or reply to a comment?",
      "How do I follow a creator?",
    ],
  },
  {
    id: "event-tickets",
    title: "Buy event tickets",
    keywords: [
      "ticket",
      "tickets",
      "event ticket",
      "buy ticket",
      "paid event",
      "ticket price",
      "ticket order",
      "payment reference",
    ],
    answer:
      "For an approved paid event, open the event page and use Get tickets. Choose the number and ticket type of your passes when the event offers categories, follow the organizer’s payment instructions, and submit your payment reference. Your order stays under payment review until the organizer verifies it.",
    actionIds: ["events", "myTickets", "login"],
    followUps: [
      "Where can I see my QR ticket?",
      "How does ticket scanning work?",
    ],
  },
  {
    id: "ticket-qr-download",
    title: "View and download a ticket QR code",
    keywords: [
      "qr ticket",
      "qr code ticket",
      "download ticket",
      "download qr",
      "my ticket",
      "my tickets",
      "ticket code",
      "ticket pass",
      "issued ticket",
    ],
    answer:
      "After the organizer approves your payment, open Account → My Tickets. Each individual LIBERIA360 pass appears with its ticket type, ticket number, status, and a branded QR code. View it on your phone or tap Download QR to save it as an image. Keep the QR code private because each pass can be redeemed only once. If a pass is cancelled, it is marked cancelled and cannot be used.",
    actionIds: ["myTickets", "account"],
    followUps: [
      "How do I buy an event ticket?",
      "How does an organizer scan a ticket?",
    ],
  },
  {
    id: "organizer-ticket-scanning",
    title: "Organizer ticket scanning and one-time redemption",
    keywords: [
      "scan ticket",
      "scan tickets",
      "ticket scanner",
      "validate ticket",
      "redeem ticket",
      "organizer scan",
      "check qr ticket",
      "already scanned",
      "ticket fraud",
    ],
    answer:
      "An event organizer opens the event’s Ticket orders area and chooses Open ticket scanner. The dedicated scanner page works with the phone camera, including iPhone Safari and Android browsers. A valid pass is accepted once. The scanner distinguishes valid, already used, cancelled, wrong-event, and invalid tickets. Organizers should only scan passes for their own event and should not accept copied or previously redeemed codes.",
    actionIds: ["myEvents", "events"],
    followUps: [
      "Where can attendees download their QR ticket?",
      "How do I review ticket payments?",
    ],
  },
  {
    id: "ticket-order-review",
    title: "Organizer ticket orders and payment review",
    keywords: [
      "incoming tickets",
      "ticket orders",
      "review ticket payment",
      "approve ticket",
      "issue ticket",
      "payment review ticket",
      "reject ticket order",
    ],
    answer:
      "Event organizers review incoming ticket orders from My Events → the event → Ticket orders. Check the payment reference and either approve the order to issue individual QR passes, including the selected ticket types when applicable, or reject it with a note. Approved tickets can be cancelled individually if needed. Scanning is handled separately on the dedicated Open ticket scanner page.",
    actionIds: ["myEvents", "events"],
    followUps: [
      "How do I scan a ticket?",
      "How do attendees get their QR code?",
    ],
  },
  {
    id: "customer-support",
    title: "Customer support and getting help",
    keywords: [
      "customer service",
      "customer support",
      "support contact",
      "refund",
      "ticket problem",
      "contact support",
      "contact liberia360",
      "help from the team",
      "report a problem",
      "technical problem",
      "need assistance",
    ],
    answer:
      "Use Account → Customer Support as the official LIBERIA360 support channel. Choose the closest category, such as Account, Booking, Payment or event ticket, Listing, Technical, Safety, Feedback, or Other for an advertisement issue. Include the relevant reference, explain what happened, and attach a screenshot when useful. You can follow replies and updates from the support request thread. The assistant cannot change accounts, approve listings, issue refunds, or manually validate tickets. Never send passwords, verification codes, full payment credentials, or QR payloads in chat.",
    actionIds: ["support", "account"],
    followUps: [
      "How do I report wrong information?",
      "What can the assistant do?",
    ],
  },
  {
    id: "assistant-help",
    title: "What the assistant can do",
    keywords: [
      "chatbot",
      "assistant",
      "ai",
      "ask question",
      "what can you do",
      "can you help",
      "how do you work",
    ],
    answer:
      "I am the LIBERIA360 Assistant. I explain how the app works and can guide you to search, add a business, advertise, book, plan a trip, use creator features, manage events, buy tickets, download QR passes, and understand ticket scanning. I cannot approve, verify, publish, delete, pay, issue refunds, or submit forms for you. Never share passwords, codes, or payment details in chat.",
    actionIds: ["home", "search", "account"],
    followUps: ["How do I add my business?", "How does advertising work?"],
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
      "Use Events to see what is happening in Liberia. Open an event for its date, location, and details. Signed-in users can also use Add an event to submit an event for the platform. Approved paid events can accept ticket orders; organizers review payment references before issuing individual QR passes.",
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
  "How do I get my event QR ticket?",
  "How do I contact customer support?",
  "How do bookings work?",
  "How do event tickets work?",
  "Where can I download my QR ticket?",
  "How do car rentals work?",
  "How do I become a creator?",
];

export const ASSISTANT_KNOWLEDGE_TEXT = ASSISTANT_KNOWLEDGE.map(
  (entry) =>
    `${entry.id} | ${entry.title}\n${entry.answer}\nAllowed actions: ${entry.actionIds.join(", ")}`,
).join("\n\n");
