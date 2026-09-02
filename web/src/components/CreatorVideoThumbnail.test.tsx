import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreatorVideoThumbnail } from "./CreatorVideoThumbnail";

class MockIntersectionObserver {
  static instance: MockIntersectionObserver;
  callback: IntersectionObserverCallback;
  observe = jest.fn();
  disconnect = jest.fn();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instance = this;
  }

  trigger(entry: Partial<IntersectionObserverEntry>) {
    this.callback(
      [
        {
          isIntersecting: false,
          intersectionRatio: 0,
          ...entry,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}

describe("CreatorVideoThumbnail", () => {
  const originalIntersectionObserver = window.IntersectionObserver;
  const originalMatchMedia = window.matchMedia;
  let play: jest.SpyInstance;
  let pause: jest.SpyInstance;

  beforeEach(() => {
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    play = jest
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    pause = jest
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver;
    window.matchMedia = originalMatchMedia;
    play.mockRestore();
    pause.mockRestore();
  });

  it("renders direct videos in a stable portrait frame with silent inline looping playback", () => {
    render(
      <CreatorVideoThumbnail
        src="https://cdn.example.com/video.mp4"
        label="Open creator video"
        autoplayOnView
      />,
    );

    const video = screen.getByLabelText("Open creator video");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("loop");
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video.parentElement).toHaveClass("aspect-[4/5]");
    expect(MockIntersectionObserver.instance.observe).toHaveBeenCalled();
  });

  it("plays at the visibility threshold and pauses/reset when it leaves", async () => {
    render(
      <CreatorVideoThumbnail
        src="https://cdn.example.com/video.mp4"
        label="Open creator video"
        autoplayOnView
      />,
    );
    const video = screen.getByLabelText(
      "Open creator video",
    ) as HTMLVideoElement;

    MockIntersectionObserver.instance.trigger({
      isIntersecting: true,
      intersectionRatio: 0.6,
    });
    await waitFor(() => expect(play).toHaveBeenCalled());

    MockIntersectionObserver.instance.trigger({
      isIntersecting: false,
      intersectionRatio: 0.2,
    });
    expect(pause).toHaveBeenCalled();
    expect(video.currentTime).toBe(0);
  });

  it("does not autoplay when reduced motion is enabled", () => {
    (window.matchMedia as jest.Mock).mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(
      <CreatorVideoThumbnail
        src="https://cdn.example.com/video.mp4"
        label="Open creator video"
        autoplayOnView
      />,
    );

    expect(play).not.toHaveBeenCalled();
    expect(screen.getByText("Video")).toBeInTheDocument();
  });

  it("reveals the valid source when its first decoded frame arrives without a poster", () => {
    render(
      <CreatorVideoThumbnail
        src="https://cdn.example.com/video.mp4"
        label="Open creator video"
      />,
    );
    const video = screen.getByLabelText("Open creator video");
    expect(video).toHaveClass("opacity-0");

    fireEvent.loadedData(video);
    expect(video).toHaveClass("opacity-100");
  });
});
