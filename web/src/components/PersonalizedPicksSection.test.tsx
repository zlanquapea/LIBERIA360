import { render, screen, waitFor } from "@testing-library/react";
import { PersonalizedPicksSection } from "./PersonalizedPicksSection";
import type { AuthUser } from "@/lib/types";

const mockUseAuth = jest.fn();
const mockGetPlaces = jest.fn();
const mockGetMySavedPlaces = jest.fn();
const mockGetRecentlyViewed = jest.fn();

jest.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock("../lib/api", () => ({
  getPlaces: (...args: unknown[]) => mockGetPlaces(...args),
}));
jest.mock("../lib/saved-places-api", () => {
  const actual = jest.requireActual("../lib/saved-places-api");
  return {
    ...actual,
    getMySavedPlaces: (...args: unknown[]) => mockGetMySavedPlaces(...args),
  };
});
jest.mock("../lib/recently-viewed", () => ({
  getRecentlyViewed: (...args: unknown[]) => mockGetRecentlyViewed(...args),
}));

const USER: AuthUser = {
  id: "u1",
  name: "Test User",
  email: "test@example.com",
  phone: null,
  profileImage: null,
  authProvider: "email",
  homeCounty: null,
  isAdmin: false,
  isSuperAdmin: false,
  travelerType: null,
  interests: [],
  twoFactorEnabled: false,
  emailVerified: true,
  pendingActivation: false,
  explorerProfilePublic: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function makePlace(id: string) {
  return {
    id,
    name: id,
    slug: id,
    images: [],
    city: "Monrovia",
    county: { id: "c1", name: "Montserrado" },
    category: { id: "cat1", name: "Beaches", slug: "beaches" },
    rating: 0,
    reviewCount: 0,
  } as never;
}

function pageOf(places: unknown[]) {
  return { data: places, meta: { total: places.length, page: 1, limit: 10, totalPages: 1 } };
}

describe("PersonalizedPicksSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRecentlyViewed.mockReturnValue([]);
    mockGetMySavedPlaces.mockResolvedValue({ slugs: [], categories: [] });
    mockGetPlaces.mockResolvedValue(pageOf([]));
  });

  it("shows the signed-out prompt without querying anything", () => {
    mockUseAuth.mockReturnValue({ user: null, token: null, ready: true });
    render(<PersonalizedPicksSection businessVerificationByPlaceId={new Map()} />);
    expect(screen.getByText(/sign up for picks made for you/i)).toBeInTheDocument();
    expect(mockGetPlaces).not.toHaveBeenCalled();
  });

  it("falls back to the no-signal prompt when interests, saves, and recent views are all empty", async () => {
    mockUseAuth.mockReturnValue({ user: { ...USER, interests: [] }, token: "tok", ready: true });
    render(<PersonalizedPicksSection businessVerificationByPlaceId={new Map()} />);
    expect(await screen.findByText(/add your interests/i)).toBeInTheDocument();
  });

  it("queries by signup interests when that's the only signal", async () => {
    mockUseAuth.mockReturnValue({ user: { ...USER, interests: ["beaches"] }, token: "tok", ready: true });
    mockGetPlaces.mockResolvedValue(pageOf([makePlace("p1")]));
    render(<PersonalizedPicksSection businessVerificationByPlaceId={new Map()} />);
    await waitFor(() => expect(mockGetPlaces).toHaveBeenCalledWith(expect.objectContaining({ category: "beaches" })));
  });

  it("ranks a saved-place category above a merely-recently-viewed one when interests are silent on both", async () => {
    mockUseAuth.mockReturnValue({ user: { ...USER, interests: [] }, token: "tok", ready: true });
    mockGetMySavedPlaces.mockResolvedValue({ slugs: ["s1"], categories: ["nature"] });
    mockGetRecentlyViewed.mockReturnValue([
      { id: "r1", kind: "place", href: "/places/r1", title: "R1", subtitle: null, imageUrl: null, viewedAt: "now", categorySlug: "nightlife" },
    ]);
    mockGetPlaces.mockResolvedValue(pageOf([makePlace("p1")]));
    render(<PersonalizedPicksSection businessVerificationByPlaceId={new Map()} />);

    await waitFor(() => expect(mockGetPlaces).toHaveBeenCalled());
    const queriedCategories = mockGetPlaces.mock.calls.map((call) => call[0].category);
    // "nature" (saved, weight 2) must be queried before "nightlife" (recently
    // viewed once, weight 1) — the merged ranking, not just interests.
    expect(queriedCategories.indexOf("nature")).toBeLessThan(queriedCategories.indexOf("nightlife"));
  });

  it("lets frequency from repeated recent views outweigh a single saved-place category", async () => {
    mockUseAuth.mockReturnValue({ user: { ...USER, interests: [] }, token: "tok", ready: true });
    mockGetMySavedPlaces.mockResolvedValue({ slugs: ["s1"], categories: ["nature"] });
    mockGetRecentlyViewed.mockReturnValue([
      { id: "r1", kind: "place", href: "/places/r1", title: "R1", subtitle: null, imageUrl: null, viewedAt: "now", categorySlug: "nightlife" },
      { id: "r2", kind: "place", href: "/places/r2", title: "R2", subtitle: null, imageUrl: null, viewedAt: "now", categorySlug: "nightlife" },
      { id: "r3", kind: "place", href: "/places/r3", title: "R3", subtitle: null, imageUrl: null, viewedAt: "now", categorySlug: "nightlife" },
    ]);
    mockGetPlaces.mockResolvedValue(pageOf([makePlace("p1")]));
    render(<PersonalizedPicksSection businessVerificationByPlaceId={new Map()} />);

    await waitFor(() => expect(mockGetPlaces).toHaveBeenCalled());
    const queriedCategories = mockGetPlaces.mock.calls.map((call) => call[0].category);
    // "nightlife" viewed 3x (weight 3) now outranks "nature" saved once
    // (weight 2) — frequency-weighted, not a simple union.
    expect(queriedCategories.indexOf("nightlife")).toBeLessThan(queriedCategories.indexOf("nature"));
  });

  it("still renders picks when getMySavedPlaces fails, using the other signals", async () => {
    mockUseAuth.mockReturnValue({ user: { ...USER, interests: ["beaches"] }, token: "tok", ready: true });
    mockGetMySavedPlaces.mockRejectedValue(new Error("network error"));
    mockGetPlaces.mockResolvedValue(pageOf([makePlace("p1")]));
    render(<PersonalizedPicksSection businessVerificationByPlaceId={new Map()} />);
    await waitFor(() => expect(mockGetPlaces).toHaveBeenCalledWith(expect.objectContaining({ category: "beaches" })));
  });
});
