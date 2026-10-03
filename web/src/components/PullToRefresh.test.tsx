import { act, fireEvent, render, screen } from "@testing-library/react";
import { PullToRefresh } from "./PullToRefresh";

jest.mock("next/navigation", () => ({ usePathname: () => "/creators" }));
const touch = (x: number, y: number) => ({
  identifier: 1,
  clientX: x,
  clientY: y,
});
function pull(target: Element, dx = 24, dy = 160, cancel = false) {
  fireEvent.touchStart(target, { touches: [touch(100, 100)] });
  const move = new Event("touchmove", { bubbles: true, cancelable: true });
  Object.defineProperty(move, "touches", {
    value: [touch(100 + dx, 100 + dy)],
  });
  fireEvent(target, move);
  if (cancel) fireEvent.touchCancel(target);
  else
    fireEvent.touchEnd(target, { changedTouches: [touch(100 + dx, 100 + dy)] });
  act(() => {
    jest.runOnlyPendingTimers();
  });
  return move;
}
beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
function setup() {
  const refresh = jest.fn();
  const view = render(
    <>
      <PullToRefresh onRefresh={refresh} />
      <div data-testid="page">Page</div>
      <textarea aria-label="Draft" />
    </>,
  );
  return { refresh, page: screen.getByTestId("page"), ...view };
}
it("accepts a natural downward swipe with sideways drift and refreshes once", () => {
  const { refresh, page } = setup();
  expect(pull(page).defaultPrevented).toBe(true);
  expect(refresh).toHaveBeenCalledTimes(1);
  pull(page);
  expect(refresh).toHaveBeenCalledTimes(1);
});
it("accepts the negative top offset from iOS rubber-banding", () => {
  const { refresh, page } = setup();
  Object.defineProperty(window, "scrollY", { configurable: true, value: -25 });
  pull(page);
  expect(refresh).toHaveBeenCalledTimes(1);
});
it("ignores short, horizontal, cancelled and multi-touch gestures", () => {
  const { refresh, page } = setup();
  pull(page, 0, 30);
  pull(page, 180, 30);
  pull(page, 10, 160, true);
  fireEvent.touchStart(page, { touches: [touch(100, 100)] });
  fireEvent.touchMove(page, {
    touches: [touch(100, 280), { ...touch(130, 280), identifier: 2 }],
  });
  fireEvent.touchEnd(page, { changedTouches: [touch(100, 280)] });
  act(() => {
    jest.runOnlyPendingTimers();
  });
  expect(refresh).not.toHaveBeenCalled();
});
it("does not refresh a scrolled page, nested scroller or focused draft", () => {
  const { refresh, page } = setup();
  Object.defineProperty(window, "scrollY", { configurable: true, value: 50 });
  pull(page);
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  page.scrollTop = 30;
  pull(page);
  page.scrollTop = 0;
  screen.getByLabelText("Draft").focus();
  pull(page);
  expect(refresh).not.toHaveBeenCalled();
});
it("preserves offline content and lets the user keep unsaved changes", () => {
  const { refresh, page } = setup();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  pull(page);
  expect(refresh).not.toHaveBeenCalled();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.input(screen.getByLabelText("Draft"), {
    target: { value: "Draft" },
  });
  pull(page);
  expect(confirm).toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});
it("removes listeners and cancels pending reload on unmount", () => {
  const { refresh, page, unmount } = setup();
  fireEvent.touchStart(page, { touches: [touch(100, 100)] });
  fireEvent.touchMove(page, { touches: [touch(120, 260)] });
  fireEvent.touchEnd(page, { changedTouches: [touch(120, 260)] });
  unmount();
  act(() => {
    jest.runOnlyPendingTimers();
  });
  expect(refresh).not.toHaveBeenCalled();
  expect(document.documentElement.style.overscrollBehaviorY).not.toBe("none");
});
