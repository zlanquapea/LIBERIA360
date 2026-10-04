import { render, screen, fireEvent } from "@testing-library/react";
import { BeforeYouGo } from "./BeforeYouGo";
const props = {
  datesSet: true,
  hasPlaces: true,
  hasPartners: false,
  budgetReady: false,
  packingReady: null,
  offlineReady: false,
  onOpen: jest.fn(),
};
function openCard() {
  fireEvent.click(screen.getByText("Before you go"));
}
it("counts saved progress without requiring travel partners", () => {
  render(<BeforeYouGo {...props} budgetReady packingReady offlineReady />);
  expect(screen.getByText("5 of 5 ready · Tap to review")).toBeInTheDocument();
});
it("does not treat unavailable data as complete", () => {
  render(<BeforeYouGo {...props} />);
  openCard();
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "2");
  expect(screen.getByText("Status not available yet")).toBeInTheDocument();
});
it("opens the matching destination", () => {
  const onOpen = jest.fn();
  render(<BeforeYouGo {...props} onOpen={onOpen} />);
  openCard();
  fireEvent.click(screen.getByRole("button", { name: "Open set a budget" }));
  expect(onOpen).toHaveBeenLastCalledWith("budget");
  fireEvent.click(
    screen.getByRole("button", { name: "Open save for offline access" }),
  );
  expect(onOpen).toHaveBeenLastCalledWith("offline");
});
it("updates progress when saved state changes", () => {
  const { rerender } = render(<BeforeYouGo {...props} />);
  rerender(<BeforeYouGo {...props} budgetReady packingReady />);
  expect(
    screen.getByText("4 of 5 ready · Tap to see what’s left"),
  ).toBeInTheDocument();
});
