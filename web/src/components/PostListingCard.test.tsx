import { render, screen } from "@testing-library/react";
import { PostListingCard } from "./PostListingCard";
jest.mock("../lib/api", () => ({ getPlaceBySlug: jest.fn().mockResolvedValue({ id: "place1", slug: "robertsport", name: "Robertsport" }) }));
jest.mock("./SaveButton", () => ({ SaveButton: ({ placeId }: { placeId: string }) => <button>Save {placeId}</button> }));
jest.mock("./AddToTripButton", () => ({ AddToTripButton: ({ itemId }: { itemId: string }) => <button>Add {itemId} to trip</button> }));
it("connects a place to its real save and trip identifiers", async () => {
  render(<PostListingCard path="/places/robertsport" label="Beach" />);
  expect(await screen.findByRole("button", { name: "Save place1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add place1 to trip" })).toBeInTheDocument();
  expect(screen.getByRole("link")).toHaveAttribute("href", "/places/robertsport");
});
it("links an experience to the existing booking page", () => {
  render(<PostListingCard path="/experiences/experience1" label="Walking tour" />);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/experiences/experience1");
  expect(screen.getByText("View & book")).toBeInTheDocument();
});
it("does not render an external or invalid destination", () => {
  const { container } = render(<PostListingCard path="https://evil.test" />);
  expect(container).toBeEmptyDOMElement();
});
