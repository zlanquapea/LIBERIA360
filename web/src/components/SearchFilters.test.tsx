import { fireEvent, screen } from "@testing-library/react";
import { renderWithMessages } from "@/test/render-with-messages";
import { SearchFilters } from "./SearchFilters";

const mockPush = jest.fn();
let mockParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockParams,
}));

beforeEach(() => {
  sessionStorage.clear();
  mockPush.mockClear();
  mockParams = new URLSearchParams();
});

it("preserves existing county and budget when choosing amenities", () => {
  mockParams = new URLSearchParams(
    "county=montserrado&priceMax=10&page=3",
  );
  renderWithMessages(<SearchFilters categories={[]} counties={[]} />);
  fireEvent.change(screen.getByLabelText("Amenity"), {
    target: { value: "parking" },
  });
  expect(mockPush).toHaveBeenCalledWith(
    "/search?county=montserrado&priceMax=10&amenity=parking",
  );
  expect(sessionStorage.getItem("liberia360:search-filters")).toContain(
    "county=montserrado",
  );
});

it("lets users explicitly restore filters while keeping the current search text", () => {
  sessionStorage.setItem(
    "liberia360:search-filters",
    "amenity=wifi&priceMax=10",
  );
  mockParams = new URLSearchParams("q=beach");
  renderWithMessages(<SearchFilters categories={[]} counties={[]} />);
  fireEvent.click(screen.getByText("Restore previous filters"));
  expect(mockPush).toHaveBeenCalledWith(
    "/search?amenity=wifi&priceMax=10&q=beach",
  );
});
