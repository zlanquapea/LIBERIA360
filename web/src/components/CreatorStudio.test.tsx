import { fireEvent, render, screen } from "@testing-library/react";
import { CreatorStudio } from "./CreatorStudio";
import { getMyCreatorPosts } from "../lib/creator-feed-api";
import { getCreatorBookings } from "../lib/booking-api";
import { listInbox } from "../lib/conversations-api";
import type { Creator } from "../lib/types";
jest.mock("../lib/creator-feed-api", () => ({ getMyCreatorPosts: jest.fn() }));
jest.mock("../lib/booking-api", () => ({ getCreatorBookings: jest.fn() }));
jest.mock("../lib/conversations-api", () => ({ listInbox: jest.fn() }));
jest.mock("./CreatorOfferingsManager", () => ({
  CreatorOfferingsManager: () => <div>Service editor</div>,
}));
const creator = {
  id: "creator",
  name: "Wonders Penny",
  username: "wonders",
  offerings: [],
} as unknown as Creator;
beforeEach(() => {
  jest.mocked(getMyCreatorPosts).mockResolvedValue([]);
  jest.mocked(getCreatorBookings).mockResolvedValue([]);
  jest.mocked(listInbox).mockResolvedValue([]);
});
it("uses live counts and edit links, with keyboard tab navigation", async () => {
  jest.mocked(listInbox).mockResolvedValue([{ unreadCount: 7 }] as never);
  jest
    .mocked(getCreatorBookings)
    .mockResolvedValue([
      {
        id: "b",
        status: "pending",
        guest: { name: "Test guest" },
        requestedDate: "2026-11-10",
        createdAt: "2026-09-28",
      },
    ] as never);
  jest
    .mocked(getMyCreatorPosts)
    .mockResolvedValue([
      {
        id: "post1",
        caption: "My work",
        mediaType: "text",
        status: "published",
        likeCount: 5,
        commentCount: 2,
        createdAt: "2026-09-28",
      },
    ] as never);
  const edit = jest.fn();
  render(
    <CreatorStudio
      creator={creator}
      token="token"
      onChange={jest.fn()}
      onEditProfile={edit}
    />,
  );
  expect(await screen.findByText("My work", { selector: "p" })).toBeVisible();
  expect(
    screen.getByRole("link", { name: /7 Unread messages/ }),
  ).toHaveAttribute("href", "/messages");
  expect(screen.getByRole("link", { name: "Edit My work" })).toHaveAttribute(
    "href",
    "/creators/me/create?edit=post1",
  );
  fireEvent.keyDown(screen.getByRole("tab", { name: "posts" }), {
    key: "ArrowRight",
  });
  expect(screen.getByText("Service editor")).toBeVisible();
  expect(screen.getByRole("tab", { name: "services" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: /1 Pending bookings/ }));
  expect(screen.getByText("Test guest")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Edit creator profile" }));
  expect(edit).toHaveBeenCalled();
});
it("shows failure instead of an empty state, and retries", async () => {
  jest.mocked(getMyCreatorPosts).mockRejectedValueOnce(new Error("offline"));
  render(
    <CreatorStudio
      creator={creator}
      token="token"
      onChange={jest.fn()}
      onEditProfile={jest.fn()}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn’t load posts",
  );
  expect(screen.queryByText("Share your first post")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Share your first post")).toBeVisible();
});
