import { render, screen } from "@testing-library/react";
import { EventCarousel } from "./EventCarousel";
import type { Event } from "@/lib/types";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));

jest.mock("./EventCard", () => ({
  EventCard: ({ event }: { event: Event }) => (
    <article aria-label={`event card ${event.name}`}>{event.name}</article>
  ),
}));

function event(name: string): Event {
  return { id: name, name } as Event;
}

describe("EventCarousel", () => {
  it("shows the empty state and no cards when there are no qualifying events", () => {
    render(<EventCarousel events={[]} />);

    expect(
      screen.getByText("No upcoming events listed yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("shows one qualifying event and no empty state", () => {
    render(<EventCarousel events={[event("Liberia Food Festival")]} />);

    expect(
      screen.getByRole("article", { name: "event card Liberia Food Festival" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No upcoming events listed yet."),
    ).not.toBeInTheDocument();
  });

  it("shows all qualifying events and no empty state", () => {
    render(
      <EventCarousel events={[event("Festival"), event("Trip meetup")]} />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(
      screen.queryByText("No upcoming events listed yet."),
    ).not.toBeInTheDocument();
  });
});
