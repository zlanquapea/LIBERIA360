import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreatorPostCard } from "./CreatorPostCard";
import type { CreatorPost } from "../lib/types";

const mockPush = jest.fn();
const mockUseAuth = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock("../lib/creator-feed-api", () => ({
  recordCreatorPostShare: jest.fn().mockResolvedValue({ shareCount: 1 }),
  removeCreatorPost: jest.fn().mockResolvedValue(undefined),
  toggleCreatorPostLike: jest.fn().mockResolvedValue({ liked: true, likeCount: 1 }),
  toggleCreatorPostSave: jest.fn().mockResolvedValue({ saved: true, saveCount: 1 }),
  getCreatorPostComments: jest.fn().mockResolvedValue([]),
  addCreatorPostComment: jest.fn(),
  removeCreatorPostComment: jest.fn(),
  toggleCreatorPostCommentLike: jest.fn(),
}));
jest.mock("./CreatorPostMedia", () => ({
  CreatorPostMedia: () => <div data-testid="post-media" />,
}));
jest.mock("./CreatorFollowButton", () => ({
  CreatorFollowButton: () => null,
}));
jest.mock("./ShareMenu", () => ({
  ShareMenu: () => <button type="button">Share</button>,
}));
jest.mock("./VerificationBadge", () => ({
  VerificationBadge: () => null,
}));

const post = {
  id: "post-1",
  creatorId: "creator-1",
  mediaType: "text",
  mediaUrl: "",
  caption: "A creator update",
  status: "published",
  likeCount: 2,
  commentCount: 0,
  saveCount: 0,
  shareCount: 0,
  creator: {
    id: "creator-1",
    name: "Sam W.W. Gboyah",
    username: "sam",
    profileImage: null,
    verificationStatus: "verified",
    availabilityStatus: "accepting_requests",
    category: "cultural",
    county: null,
  },
  viewerLiked: false,
  viewerSaved: false,
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
} as CreatorPost;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    token: "test-token",
    user: { id: "user-1", name: "Sam W.W. Gboyah" },
    ready: true,
  });
});

describe("CreatorPostCard actions", () => {
  it("opens the two-item overflow menu and dismisses it outside or with Escape", async () => {
    const user = userEvent.setup();
    render(<CreatorPostCard post={post} />);

    await user.click(screen.getByRole("button", { name: "More post actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More post actions" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("calls onEdit with the post and closes the menu", async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();
    render(<CreatorPostCard post={post} onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: "More post actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledWith(post.id, post);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("requires confirmation before calling onDelete and shows destructive loading state", async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(<CreatorPostCard post={post} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "More post actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete post?")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(post.id));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("calls onSave and onUnsave from the bottom action row", async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onUnsave = jest.fn().mockResolvedValue(undefined);
    render(<CreatorPostCard post={post} onSave={onSave} onUnsave={onUnsave} />);

    const saveButton = screen.getByRole("button", { name: "Save post" });
    expect(saveButton).toHaveTextContent("Save");
    await user.click(saveButton);
    expect(onSave).toHaveBeenCalledWith(post.id);

    const unsaveButton = await screen.findByRole("button", { name: "Unsave post" });
    await user.click(unsaveButton);
    expect(onUnsave).toHaveBeenCalledWith(post.id);
    expect(screen.getByRole("button", { name: "Save post" })).toBeInTheDocument();
  });
});
