import { fireEvent, screen } from "@testing-library/react";
import Link from "next/link";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { renderWithMessages } from "@/test/render-with-messages";
import { BrandedErrorState } from "./BrandedErrorState";

// A stand-in for whatever Link variant a real caller passes (see
// BrandedErrorState's own doc comment on `homeAction`) — plain next/link
// works fine here since these tests don't touch i18n routing, and (unlike
// a raw <a href="/">) doesn't trip the no-html-link-for-pages lint rule.
const homeLink = (
  <Link href="/">Go home</Link>
);

describe("BrandedErrorState", () => {
  it("shows the given title/description and the caller's home action", () => {
    renderWithMessages(
      <BrandedErrorState
        icon={ExclamationTriangleIcon}
        title="Something went wrong"
        description="Sorry about that."
        homeAction={homeLink}
      />,
    );

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText("Sorry about that.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
  });

  it("only renders a retry button when onRetry is passed, and calls it on click", () => {
    const onRetry = jest.fn();
    const { rerender } = renderWithMessages(
      <BrandedErrorState
        icon={ExclamationTriangleIcon}
        title="Something went wrong"
        description="Sorry about that."
        homeAction={homeLink}
      />,
    );
    // A not-found page (no onRetry) has nothing to retry — only "Go home".
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();

    rerender(
      <BrandedErrorState
        icon={ExclamationTriangleIcon}
        title="Something went wrong"
        description="Sorry about that."
        onRetry={onRetry}
        homeAction={homeLink}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("lets a caller override the retry button's label", () => {
    renderWithMessages(
      <BrandedErrorState
        icon={ExclamationTriangleIcon}
        title="Something went wrong"
        description="Sorry about that."
        onRetry={() => {}}
        retryLabel="Reload"
        homeAction={homeLink}
      />,
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
