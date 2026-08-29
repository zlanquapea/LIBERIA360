import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Liberia360Assistant } from "./Liberia360Assistant";
import { askAssistant } from "../lib/assistant-api";

let mockPathname = "/";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("../lib/assistant-api", () => ({
  askAssistant: jest.fn(),
}));

const mockAskAssistant = askAssistant as jest.MockedFunction<typeof askAssistant>;

describe("Liberia360Assistant", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = "/";
    class MockPointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;

      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "touch";
      }
    }
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: MockPointerEvent,
    });
    localStorage.clear();
    sessionStorage.clear();
    Element.prototype.scrollIntoView = jest.fn();
    HTMLElement.prototype.setPointerCapture = jest.fn();
    HTMLElement.prototype.releasePointerCapture = jest.fn();
    HTMLElement.prototype.hasPointerCapture = jest.fn().mockReturnValue(true);
  });

  it("opens from the floating launcher and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<Liberia360Assistant />);

    const launcher = screen.getByRole("button", {
      name: "Open LIBERIA360 Assistant",
    });
    expect(launcher).toHaveAttribute("aria-expanded", "false");

    await user.click(launcher);
    expect(
      screen.getByRole("dialog", { name: "LIBERIA360 Assistant" }),
    ).toBeInTheDocument();
    expect(launcher).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sends a guided question and renders the approved answer and action link", async () => {
    mockAskAssistant.mockResolvedValue({
      answer: "Open My Ads and choose New ad to submit your advertisement.",
      actions: [
        { id: "ads", label: "Manage my ads", href: "/account/my-ads" },
      ],
      followUps: ["Where will my ad appear?"],
      source: "knowledge",
    });
    const user = userEvent.setup();
    render(<Liberia360Assistant />);

    await user.click(
      screen.getByRole("button", { name: "Open LIBERIA360 Assistant" }),
    );
    await user.click(
      screen.getByRole("button", { name: "How does advertising work?" }),
    );

    expect(
      await screen.findByText(
        "Open My Ads and choose New ad to submit your advertisement.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage my ads" })).toHaveAttribute(
      "href",
      "/account/my-ads",
    );
    expect(mockAskAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "How does advertising work?",
        currentPath: "/",
      }),
    );
  });

  it("submits a typed question and exposes a clear loading state", async () => {
    let resolveReply: ((value: Awaited<ReturnType<typeof askAssistant>>) => void) | undefined;
    mockAskAssistant.mockReturnValue(
      new Promise((resolve) => {
        resolveReply = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<Liberia360Assistant />);

    await user.click(
      screen.getByRole("button", { name: "Open LIBERIA360 Assistant" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Message LIBERIA360 Assistant" }),
      "How do bookings work?",
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(
      screen.getByText("LIBERIA360 Assistant is thinking"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();

    resolveReply?.({
      answer: "Open a profile and send a booking request.",
      actions: [],
      followUps: [],
      source: "ai",
    });
    expect(
      await screen.findByText("Open a profile and send a booking request."),
    ).toBeInTheDocument();
  });

  it("remembers a dragged launcher position without opening the chat", async () => {
    render(<Liberia360Assistant />);
    const launcher = screen.getByTestId("assistant-launcher");
    jest.spyOn(launcher, "getBoundingClientRect").mockReturnValue({
      x: 300,
      y: 500,
      left: 300,
      top: 500,
      right: 358,
      bottom: 558,
      width: 58,
      height: 58,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(launcher, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 329,
      clientY: 529,
    });
    fireEvent.pointerMove(launcher, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 180,
      clientY: 350,
    });
    fireEvent.pointerUp(launcher, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 180,
      clientY: 350,
    });
    fireEvent.click(launcher);

    await waitFor(() =>
      expect(localStorage.getItem("liberia360:assistant-position")).not.toBeNull(),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not render inside the admin workspace", () => {
    mockPathname = "/admin";
    render(<Liberia360Assistant />);
    expect(screen.queryByTestId("assistant-launcher")).not.toBeInTheDocument();
  });
});
