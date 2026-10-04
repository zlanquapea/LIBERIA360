import { act, fireEvent, render, screen } from "@testing-library/react";
import { CreatorPostViewer } from "./CreatorPostViewer";
import { CreatorVideoThumbnail } from "./CreatorVideoThumbnail";
import { SafeImage } from "./SafeImage";
import type { CreatorPost } from "../lib/types";
jest.mock("./ShareMenu", () => ({ ShareMenu: () => null }));
jest.mock("./VerificationBadge", () => ({ VerificationBadge: () => null }));
beforeEach(() => {
  localStorage.setItem("liberia360:data-saver", "on");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
const post = { id: "one", mediaType: "video", mediaUrl: "/uploads/video.mp4", createdAt: "2026-10-01", creator: { name: "Creator", username: "creator" } } as CreatorPost;
function viewer(mediaUrl: string) {
  return <CreatorPostViewer post={{ ...post, mediaUrl }} mode="video" shareUrl="/creators/posts/one" liked={false} saved={false} likeCount={0} commentCount={0} shareCount={0} onLike={jest.fn()} onComment={jest.fn()} onSave={jest.fn()} onShare={jest.fn()} onClose={jest.fn()} />;
}
it("does not create a video element for scrolling feed previews", () => {
  const { container } = render(<CreatorVideoThumbnail src="/video.mp4" label="Preview" autoplayOnView />);
  expect(container.querySelector("video")).toBeNull();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});
it("loads a direct video only when the user presses play", async () => {
  const { container } = render(viewer("https://liberia360.net/uploads/video.mp4"));
  const video = container.querySelector("video")!;
  expect(video.preload).toBe("none");
  expect(video.autoplay).toBe(false);
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Play video" })); });
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
});
it("defers hosted video embeds until requested", () => {
  const { container } = render(viewer("https://www.youtube.com/watch?v=abcdefghijk"));
  expect(container.querySelector("iframe")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tap to load video" }));
  expect(container.querySelector("iframe")).not.toBeNull();
});
it("prefers the compressed uploaded photo", () => {
  render(<SafeImage src="/uploads/12345678-abcd-abcd-abcd-123456789abc.jpg" alt="Place" fallback={<span>No photo</span>} />);
  expect(screen.getByRole("img")).toHaveAttribute("src", "/uploads/12345678-abcd-abcd-abcd-123456789abc-thumb.jpg");
});
