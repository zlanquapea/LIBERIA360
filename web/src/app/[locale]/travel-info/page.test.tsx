import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMessages } from "../../../test/render-with-messages";
import TravelInfoPage from "./page";

const mockGetTravelerInfo = jest.fn();

jest.mock("../../../lib/traveler-info-api", () => ({
  getTravelerInfo: (...args: unknown[]) => mockGetTravelerInfo(...args),
}));

describe("TravelInfoPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the empty state when nothing has been set yet", async () => {
    mockGetTravelerInfo.mockResolvedValue({
      id: 1,
      usdToLrdRate: null,
      visaInfo: null,
      entryRequirements: null,
      currentSeasonNote: null,
      updatedByUserId: null,
      updatedAt: new Date().toISOString(),
    });
    renderWithMessages(<TravelInfoPage />);
    expect(await screen.findByText(/isn.t available yet/i)).toBeInTheDocument();
  });

  it("renders only the blocks an admin has set, skipping unset ones", async () => {
    mockGetTravelerInfo.mockResolvedValue({
      id: 1,
      usdToLrdRate: 190,
      visaInfo: null,
      entryRequirements: null,
      currentSeasonNote: "Rainy season through October.",
      updatedByUserId: "admin-1",
      updatedAt: new Date().toISOString(),
    });
    renderWithMessages(<TravelInfoPage />);
    expect(await screen.findByText("Currency converter")).toBeInTheDocument();
    expect(screen.getByText("Rainy season through October.")).toBeInTheDocument();
    expect(screen.queryByText("Visa")).not.toBeInTheDocument();
    expect(screen.queryByText("Entry requirements")).not.toBeInTheDocument();
  });

  it("converts USD to LRD using the admin-set rate", async () => {
    mockGetTravelerInfo.mockResolvedValue({
      id: 1,
      usdToLrdRate: 190,
      visaInfo: null,
      entryRequirements: null,
      currentSeasonNote: null,
      updatedByUserId: "admin-1",
      updatedAt: new Date().toISOString(),
    });
    renderWithMessages(<TravelInfoPage />);

    const usdInput = await screen.findByLabelText("Amount in US dollars");
    await userEvent.clear(usdInput);
    await userEvent.type(usdInput, "10");

    await waitFor(() => expect(screen.getByText("L$1900.00")).toBeInTheDocument());
  });
});
