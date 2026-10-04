import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SafetyControls, BlockedAccounts } from "./SafetyControls";
import { SafetyReviewQueue } from "./SafetyReviewQueue";
import { apiRequest } from "@/lib/http";
import { useAuth } from "@/hooks/useAuth";
// Relative paths: jest.mock specifiers aren't rewritten through the @/ alias.
jest.mock("../lib/http", () => ({ apiRequest: jest.fn() }));
jest.mock("../hooks/useAuth", () => ({ useAuth: jest.fn() }));
const api = apiRequest as jest.Mock;
const auth = useAuth as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  auth.mockReturnValue({ user: { id: "viewer", isAdmin: false } });
});
it("reports just the selected message and never blocks implicitly", async () => {
  api.mockResolvedValue({ received: true });
  render(
    <SafetyControls
      targetType="conversation_message"
      targetId="message"
      accountId="author"
    />,
  );
  fireEvent.click(screen.getByText("Safety options"));
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "harassment" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send report" }));
  await screen.findByText("Report sent to the review team.");
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith(
    "/safety/reports",
    expect.objectContaining({
      body: JSON.stringify({
        targetType: "conversation_message",
        targetId: "message",
        reason: "harassment",
      }),
    }),
  );
});
it("requires block confirmation and preserves the control on API failure", async () => {
  api.mockRejectedValue(new Error("Please retry"));
  const onBlocked = jest.fn();
  render(
    <SafetyControls
      targetType="creator_post"
      targetId="post"
      creatorId="creator"
      onBlocked={onBlocked}
    />,
  );
  fireEvent.click(screen.getByText("Safety options"));
  fireEvent.click(screen.getByRole("button", { name: "Block account" }));
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm block" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please retry");
  expect(onBlocked).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Confirm block" })).toBeEnabled();
});
it("lets users undo their block", async () => {
  api
    .mockResolvedValueOnce([{ id: "author", name: "A creator" }])
    .mockResolvedValue({ blocked: false });
  render(<BlockedAccounts />);
  fireEvent.click(await screen.findByRole("button", { name: "Unblock" }));
  await screen.findByText("No blocked accounts.");
  expect(api).toHaveBeenLastCalledWith("/safety/blocks/author", {
    method: "DELETE",
  });
});
it("does not fetch moderation reports for regular users", () => {
  render(<SafetyReviewQueue />);
  expect(api).not.toHaveBeenCalled();
});
it("shows admins the evidence and requires confirmation before hiding", async () => {
  auth.mockReturnValue({ user: { id: "admin", isAdmin: true } });
  api.mockResolvedValue({
    data: [
      {
        id: "report",
        targetType: "creator_post",
        reason: "spam",
        snapshot: { text: "Reported post" },
        createdAt: "2026-10-04T00:00:00Z",
      },
    ],
    hasMore: false,
  });
  render(<SafetyReviewQueue />);
  await screen.findByText("Reported post");
  fireEvent.click(screen.getByRole("button", { name: "Hide content" }));
  expect(api).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Confirm hide" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("/safety/reports/report", {
      method: "PATCH",
      body: '{"action":"hide"}',
    }),
  );
});
