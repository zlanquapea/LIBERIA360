import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMessages } from "@/test/render-with-messages";
import { GlobalSearch } from "./GlobalSearch";
import { getSearchSuggestions } from "../lib/api";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../lib/api", () => ({
  getSearchSuggestions: jest.fn(),
}));

const suggestions = {
  query: "rob",
  places: [
    {
      kind: "place",
      id: "p1",
      slug: "robertsport",
      name: "Robertsport",
      image: null,
      type: "nature_site",
      city: "Robertsport",
      county: { name: "Grand Cape Mount" },
    },
  ],
  businesses: [],
  events: [],
  creators: [],
};

beforeEach(() => {
  mockPush.mockClear();
  (getSearchSuggestions as jest.Mock).mockReset();
  localStorage.clear();
});

test("opens the overlay and shows a hint before typing enough characters", async () => {
  const user = userEvent.setup();
  renderWithMessages(<GlobalSearch />);

  await user.click(screen.getByRole("button", { name: "Search" }));

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(
    screen.getByText("Start typing to search places, businesses, events, and creators."),
  ).toBeInTheDocument();
  expect(getSearchSuggestions).not.toHaveBeenCalled();
});

test("fetches and renders grouped suggestions as the user types", async () => {
  (getSearchSuggestions as jest.Mock).mockResolvedValue(suggestions);
  const user = userEvent.setup();
  renderWithMessages(<GlobalSearch />);

  await user.click(screen.getByRole("button", { name: "Search" }));
  await user.type(screen.getByRole("combobox"), "rob");

  await waitFor(() => expect(getSearchSuggestions).toHaveBeenCalledWith("rob", expect.anything()));
  expect(await screen.findByRole("option", { name: /Robertsport/ })).toBeInTheDocument();
  expect(screen.getByText("Places")).toBeInTheDocument();
});

test("clicking a result navigates to its own page and saves a recent search", async () => {
  (getSearchSuggestions as jest.Mock).mockResolvedValue(suggestions);
  const user = userEvent.setup();
  renderWithMessages(<GlobalSearch />);

  await user.click(screen.getByRole("button", { name: "Search" }));
  await user.type(screen.getByRole("combobox"), "rob");

  const result = await screen.findByRole("option", { name: /Robertsport/ });
  await user.click(result);

  expect(mockPush).toHaveBeenCalledWith("/places/robertsport");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("liberia360:recent-searches") ?? "[]")).toEqual([
    "Robertsport",
  ]);
});

test("Escape closes the overlay without navigating", async () => {
  const user = userEvent.setup();
  renderWithMessages(<GlobalSearch />);

  await user.click(screen.getByRole("button", { name: "Search" }));
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mockPush).not.toHaveBeenCalled();
});

test("submitting with no active suggestion goes to the full search page", async () => {
  (getSearchSuggestions as jest.Mock).mockResolvedValue(suggestions);
  const user = userEvent.setup();
  renderWithMessages(<GlobalSearch />);

  await user.click(screen.getByRole("button", { name: "Search" }));
  await user.type(screen.getByRole("combobox"), "rob");
  await screen.findByRole("option", { name: /Robertsport/ });
  await user.keyboard("{Enter}");

  expect(mockPush).toHaveBeenCalledWith("/search?q=rob");
});
