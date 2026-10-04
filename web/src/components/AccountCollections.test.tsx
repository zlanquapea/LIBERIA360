import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CollectionsManager } from "./CollectionsManager";
import { apiRequest } from "@/lib/http";
let mockUser = { id: "owner" };
jest.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, ready: true }),
}));
jest.mock("../lib/http", () => ({ apiRequest: jest.fn() }));
const request = apiRequest as jest.Mock;
beforeEach(() => {
  request.mockReset();
  localStorage.clear();
  mockUser = { id: "owner" };
  window.history.replaceState({}, "", "/collections");
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "new-id",
  });
});
it("loads account collections and waits for server confirmation when creating", async () => {
  request
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce({
      id: "new-id",
      name: "Weekend",
      items: [],
      version: 1,
      shareToken: null,
    });
  render(<CollectionsManager />);
  await screen.findByLabelText("New collection name");
  fireEvent.change(screen.getByLabelText("New collection name"), {
    target: { value: "Weekend" },
  });
  fireEvent.click(screen.getByText("Create collection"));
  expect(
    await screen.findByRole("option", { name: "Weekend (0)" }),
  ).toBeInTheDocument();
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
    name: "Weekend",
    items: [],
    version: 0,
  });
});
it("shows save errors and does not pretend the collection was saved", async () => {
  request.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Offline"));
  render(<CollectionsManager />);
  await screen.findByLabelText("New collection name");
  fireEvent.change(screen.getByLabelText("New collection name"), {
    target: { value: "Weekend" },
  });
  fireEvent.click(screen.getByText("Create collection"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  expect(
    screen.queryByRole("option", { name: "Weekend (0)" }),
  ).not.toBeInTheDocument();
});
it("removes previous account data immediately when switching accounts", async () => {
  request
    .mockResolvedValueOnce([
      {
        id: "private",
        name: "Private list",
        items: [],
        version: 1,
        shareToken: null,
      },
    ])
    .mockResolvedValueOnce([]);
  const { rerender } = render(<CollectionsManager />);
  await screen.findByRole("option", { name: "Private list (0)" });
  mockUser = { id: "other" };
  rerender(<CollectionsManager />);
  expect(
    screen.queryByRole("option", { name: "Private list (0)" }),
  ).not.toBeInTheDocument();
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
});
