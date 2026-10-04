import { fireEvent, render, screen } from "@testing-library/react";
import { DeviceCollectionsManager as CollectionsManager } from "./DeviceCollectionsManager";
let mockUser = { id: "owner" };
jest.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, ready: true }),
}));
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/collections");
  mockUser = { id: "owner" };
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "collection-id",
  });
});
it("creates a collection, adds a place and keeps it after remounting", () => {
  const { unmount } = render(<CollectionsManager />);
  fireEvent.change(screen.getByLabelText("New collection name"), {
    target: { value: "Weekend" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create collection" }));
  fireEvent.change(screen.getByLabelText("Listing or post link"), {
    target: { value: "https://liberia360.net/places/robertsport" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add to collection" }));
  expect(screen.getByRole("link", { name: /robertsport/ })).toHaveAttribute(
    "href",
    "/places/robertsport",
  );
  unmount();
  render(<CollectionsManager />);
  expect(
    screen.getByRole("option", { name: "Weekend (1)" }),
  ).toBeInTheDocument();
});
it("does not show another account's collections after an account switch", () => {
  localStorage.setItem(
    "liberia360:collections:owner",
    JSON.stringify([{ id: "one", name: "Private list", items: [] }]),
  );
  const { rerender } = render(<CollectionsManager />);
  expect(
    screen.getByRole("option", { name: "Private list (0)" }),
  ).toBeInTheDocument();
  mockUser = { id: "other" };
  rerender(<CollectionsManager />);
  expect(
    screen.queryByRole("option", { name: "Private list (0)" }),
  ).not.toBeInTheDocument();
});
