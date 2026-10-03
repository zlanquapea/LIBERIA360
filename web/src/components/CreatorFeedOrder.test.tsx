import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreatorFeed } from "./CreatorFeed";
import { getCreatorFeed, getFollowedCreatorFeed } from "../lib/creator-feed-api";
import { shuffleCreatorPosts } from "../lib/creator-feed-shuffle";
import type { CreatorPost } from "../lib/types";
jest.mock("../hooks/useAuth", () => ({ useAuth: () => ({ token: "token", ready: true }) }));
jest.mock("../lib/api", () => ({ getActiveAdvertisements: jest.fn().mockResolvedValue([]) }));
jest.mock("../lib/creator-feed-api", () => ({ getCreatorFeed: jest.fn(), getFollowedCreatorFeed: jest.fn() }));
jest.mock("../lib/creator-feed-shuffle", () => ({ shuffleCreatorPosts: jest.fn((posts: unknown[]) => [...posts].reverse()) }));
jest.mock("./CreatorStories", () => ({ CreatorStories: () => null }));
jest.mock("./BrandLoader", () => ({ BrandLoader: () => null }));
jest.mock("./SponsoredCreatorAdCard", () => ({ SponsoredCreatorAdCard: () => null }));
jest.mock("./CreatorPostCard", () => ({ CreatorPostCard: ({ post }: { post: CreatorPost }) => <div data-testid="post">{post.id}</div> }));
const posts = [{ id: "newest", mediaType: "text" }, { id: "older", mediaType: "text" }] as CreatorPost[];
beforeEach(() => {
  jest.clearAllMocks();
  (getCreatorFeed as jest.Mock).mockResolvedValue({ data: posts, meta: { totalPages: 1 } });
  (getFollowedCreatorFeed as jest.Mock).mockResolvedValue({ data: posts, meta: { totalPages: 1 } });
});
it.each(["latest", "following"] as const)("keeps %s in server order on load and refresh", async mode => {
  render(<CreatorFeed mode={mode} initialPosts={mode === "following" ? [] : posts} />);
  await screen.findAllByTestId("post");
  fireEvent.click(screen.getByRole("button", { name: "Refresh feed" }));
  await waitFor(() => expect(screen.getByText("Feed refreshed. Newest posts appear first.")).toBeInTheDocument());
  expect(screen.getAllByTestId("post").map(node => node.textContent)).toEqual(["newest", "older"]);
  expect(shuffleCreatorPosts).not.toHaveBeenCalled();
});
it("shuffles For You on load and refresh", async () => {
  render(<CreatorFeed mode="discover" initialPosts={posts} />);
  expect(screen.getAllByTestId("post")[0]).toHaveTextContent("older");
  fireEvent.click(screen.getByRole("button", { name: "Refresh feed" }));
  await waitFor(() => expect(shuffleCreatorPosts).toHaveBeenCalledTimes(2));
});
