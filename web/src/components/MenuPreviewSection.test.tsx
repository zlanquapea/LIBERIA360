import { render, screen } from "@testing-library/react";
import { MenuPreviewSection } from "./MenuPreviewSection";
import type { MenuItem } from "@/lib/types";

function makeItem(overrides: Partial<MenuItem> & { id: string }): MenuItem {
  return {
    businessId: "b1",
    name: "Jollof Rice",
    description: null,
    price: 8.5,
    image: null,
    category: "Mains",
    isAvailable: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("MenuPreviewSection", () => {
  it("renders nothing when there are no menu items", () => {
    const { container } = render(<MenuPreviewSection items={[]} menuHref="/businesses/x/menu" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("teases every item as a link to the full menu page when within the preview count", () => {
    const items = [makeItem({ id: "1", name: "Jollof Rice" }), makeItem({ id: "2", name: "Grilled Fish" })];
    render(<MenuPreviewSection items={items} menuHref="/businesses/grill-house/menu" />);

    expect(screen.getByText("2 dishes")).toBeInTheDocument();
    // Both dish tiles and the "See full menu" CTA point at the same
    // dedicated page — no ordering UI here, just navigation.
    const links = screen.getAllByRole("link", { name: /jollof rice|grilled fish|see full menu/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/businesses/grill-house/menu");
    }
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
  });

  it("caps the teased dishes and links to the rest via a '+N more' tile", () => {
    const items = Array.from({ length: 9 }, (_, i) => makeItem({ id: `${i}`, name: `Dish ${i}` }));
    render(<MenuPreviewSection items={items} menuHref="/businesses/grill-house/menu" />);

    // 6 previewed + the "+3 more" tile, not all 9 dish names.
    expect(screen.queryByText("Dish 6")).not.toBeInTheDocument();
    expect(screen.getByText("+3 more")).toBeInTheDocument();
    expect(screen.getByText("9 dishes")).toBeInTheDocument();
  });

  it("mentions the section count only when there's more than one", () => {
    render(<MenuPreviewSection items={[makeItem({ id: "1" })]} menuHref="/x" />);
    expect(screen.getByText("1 dish")).toBeInTheDocument();

    const twoSections = [makeItem({ id: "1", category: "Mains" }), makeItem({ id: "2", category: "Drinks" })];
    render(<MenuPreviewSection items={twoSections} menuHref="/x" />);
    expect(screen.getByText("2 dishes across 2 sections")).toBeInTheDocument();
  });
});
