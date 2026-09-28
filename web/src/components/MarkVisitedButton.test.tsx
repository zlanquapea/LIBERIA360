import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MarkVisitedButton } from "./MarkVisitedButton";

const mockUseAuth = jest.fn();
const mockGetMyVisitedPlaceIds = jest.fn();
const mockMarkVisited = jest.fn();
const mockUnmarkVisited = jest.fn();

jest.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock("../lib/visited-places-api", () => ({
  getMyVisitedPlaceIds: (...args: unknown[]) => mockGetMyVisitedPlaceIds(...args),
  markVisited: (...args: unknown[]) => mockMarkVisited(...args),
  unmarkVisited: (...args: unknown[]) => mockUnmarkVisited(...args),
}));

describe("MarkVisitedButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyVisitedPlaceIds.mockResolvedValue({ placeIds: [] });
    mockMarkVisited.mockResolvedValue(undefined);
    mockUnmarkVisited.mockResolvedValue(undefined);
  });

  it("shows a login link instead of a toggle when signed out", () => {
    mockUseAuth.mockReturnValue({ token: null, ready: true });
    render(<MarkVisitedButton placeId="place-1" />);
    expect(screen.getByRole("link", { name: /mark visited/i })).toHaveAttribute("href", "/login");
  });

  it("renders nothing until auth state is ready", () => {
    mockUseAuth.mockReturnValue({ token: null, ready: false });
    const { container } = render(<MarkVisitedButton placeId="place-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks a place visited and flips to the Visited state", async () => {
    mockUseAuth.mockReturnValue({ token: "tok", ready: true });
    render(<MarkVisitedButton placeId="place-1" />);

    const toggle = await screen.findByRole("button", { name: /mark visited/i });
    fireEvent.click(toggle);

    await waitFor(() => expect(mockMarkVisited).toHaveBeenCalledWith("tok", "place-1"));
    expect(await screen.findByRole("button", { name: /^visited$/i })).toBeInTheDocument();
  });

  it("unmarks an already-visited place back to Mark visited", async () => {
    mockUseAuth.mockReturnValue({ token: "tok", ready: true });
    mockGetMyVisitedPlaceIds.mockResolvedValue({ placeIds: ["place-1"] });
    render(<MarkVisitedButton placeId="place-1" />);

    const toggle = await screen.findByRole("button", { name: /^visited$/i });
    fireEvent.click(toggle);

    await waitFor(() => expect(mockUnmarkVisited).toHaveBeenCalledWith("tok", "place-1"));
    expect(await screen.findByRole("button", { name: /mark visited/i })).toBeInTheDocument();
  });

  it("reverts the optimistic update if the request fails", async () => {
    mockUseAuth.mockReturnValue({ token: "tok", ready: true });
    mockMarkVisited.mockRejectedValue(new Error("network error"));
    render(<MarkVisitedButton placeId="place-1" />);

    const toggle = await screen.findByRole("button", { name: /mark visited/i });
    fireEvent.click(toggle);

    await waitFor(() => expect(mockMarkVisited).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /mark visited/i })).toBeInTheDocument();
  });
});
