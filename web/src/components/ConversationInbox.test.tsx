import { fireEvent, render, screen } from "@testing-library/react";
import { ConversationInbox } from "./ConversationInbox";
import { listInbox } from "../lib/conversations-api";
jest.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ token: "token", ready: true }),
}));
jest.mock("../lib/conversations-api", () => ({ listInbox: jest.fn() }));
const list = listInbox as jest.Mock;
const item = {
  kind: "conversation",
  title: "Emmanuel",
  preview: "Hello",
  updatedAt: "2026-09-26T12:00:00Z",
  contextType: "booking",
};
beforeEach(() => jest.clearAllMocks());
it("preserves separate threads and filters unread messages", async () => {
  list.mockResolvedValue([
    {
      ...item,
      id: "a",
      sourceId: "booking-a",
      unreadCount: 2,
      href: "/messages/a",
    },
    {
      ...item,
      id: "b",
      sourceId: "booking-b",
      unreadCount: 0,
      href: "/messages/b",
    },
  ]);
  render(<ConversationInbox />);
  expect(await screen.findAllByText("Emmanuel")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: /Unread/ }));
  expect(screen.getAllByText("Emmanuel")).toHaveLength(1);
  expect(screen.getByRole("link", { name: /Emmanuel/ })).toHaveAttribute(
    "href",
    "/messages/a",
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Search messages" }), {
    target: { value: "missing" },
  });
  expect(screen.getByText("No matching conversations")).toBeInTheDocument();
});
it("offers a working compose path and retry after failure", async () => {
  list.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
  render(<ConversationInbox />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "couldn’t refresh",
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("Your conversations start here");
  fireEvent.click(screen.getByRole("button", { name: "New message" }));
  expect(screen.getByRole("link", { name: /Find a creator/ })).toHaveAttribute(
    "href",
    "/creators",
  );
});
