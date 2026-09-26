import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMessages } from "@/test/render-with-messages";
import { HttpError } from "@/lib/http";
import { clearStoredAuth, setStoredAuth } from "@/lib/auth-storage";
import type { AuthUser } from "@/lib/types";
import { GuideProfileTools } from "./GuideProfileTools";
import {
  createGuideExperience,
  getGuideMessages,
  getGuideReviews,
  getMyGuideExperiences,
  getMyGuideProfile,
  openGuideChat,
} from "@/lib/guides-api";

jest.mock("../lib/uploads-api", () => ({ uploadImage: jest.fn() }));

jest.mock("../lib/guides-api", () => ({
  createGuideExperience: jest.fn(),
  createGuideReview: jest.fn(),
  getGuideMessages: jest.fn(),
  getGuideReviews: jest.fn(),
  getMyGuideExperiences: jest.fn(),
  getMyGuideProfile: jest.fn(),
  openGuideChat: jest.fn(),
  sendGuideMessage: jest.fn(),
  updateGuideExperience: jest.fn(),
  updateMyGuideProfile: jest.fn(),
}));

const GUIDE = {
  id: "guide-1",
  slug: "sam-gboyah",
  guideType: "tour_guide",
  bio: "A verified local guide in Monrovia.",
  city: "Monrovia",
  county: { name: "Montserrado" },
  languages: ["English"],
  verificationStatus: "verified",
  whatsappNumber: null,
  profileImageUrl: null,
  rating: 0,
  reviewCount: 0,
};

const USER: AuthUser = {
  id: "guide-owner",
  name: "Sam Gboyah",
  email: "sam@example.com",
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
  createdAt: "2026-01-01T00:00:00.000Z",
};

const CREATED_EXPERIENCE = {
  id: "experience-1",
  title: "Monrovia Waterside Walk",
  description: "A guided walk through the historic waterside district.",
  category: "city",
  county: "Montserrado",
  durationMinutes: 90,
  groupType: "small_group",
  maxGroupSize: 8,
  priceUsd: 25,
  priceLrd: null,
  meetingPointText: "Waterside Market",
  includes: ["Local guide"],
  cancellationPolicy: "Free cancellation up to 24 hours before.",
  coverImageUrl: null,
  imageUrls: [],
  isFeatured: false,
  status: "published",
  guide: GUIDE,
};

beforeEach(() => {
  setStoredAuth({ token: "test-token", user: USER });
  jest.clearAllMocks();
  (getGuideReviews as jest.Mock).mockResolvedValue([]);
  (getMyGuideExperiences as jest.Mock).mockResolvedValue([]);
  (getGuideMessages as jest.Mock).mockResolvedValue([]);
  (getMyGuideProfile as jest.Mock).mockResolvedValue(GUIDE);
  (openGuideChat as jest.Mock).mockReturnValue({
    addEventListener: jest.fn(),
    close: jest.fn(),
  });
});

afterEach(() => {
  clearStoredAuth();
});

describe("GuideProfileTools experience publishing", () => {
  it("shows success and sends only one request when publish is triggered twice", async () => {
    let resolvePublish!: (value: typeof CREATED_EXPERIENCE) => void;
    const pending = new Promise<typeof CREATED_EXPERIENCE>((resolve) => {
      resolvePublish = resolve;
    });
    (createGuideExperience as jest.Mock).mockReturnValueOnce(pending);

    renderWithMessages(
      <GuideProfileTools guide={GUIDE} initialExperiences={[]} />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add experience/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /add experience/i }));
    const publishButton = screen.getByRole("button", { name: /publish experience/i });

    await userEvent.click(publishButton);
    await userEvent.click(publishButton);

    expect(createGuideExperience).toHaveBeenCalledTimes(1);
    expect(publishButton).toBeDisabled();

    resolvePublish(CREATED_EXPERIENCE);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/now published/i),
    );
  });

  it("shows a backend failure and does not show a success state", async () => {
    (createGuideExperience as jest.Mock).mockRejectedValueOnce(
      new HttpError(500, "Database failed"),
    );

    render(
      <GuideProfileTools guide={GUIDE} initialExperiences={[]} />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add experience/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /add experience/i }));
    await userEvent.click(screen.getByRole("button", { name: /publish experience/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Database failed"));
    expect(screen.queryByText("Your experience is now published.")).not.toBeInTheDocument();
  });
});
