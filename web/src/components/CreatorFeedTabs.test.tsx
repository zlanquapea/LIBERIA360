import { render, screen } from "@testing-library/react";
import { CreatorFeedTabs } from "./CreatorFeedTabs";
it.each(["discover", "following", "latest"] as const)("offers three feed routes with only %s active", mode => {
  render(<CreatorFeedTabs mode={mode} />);
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(3);
  expect(links.filter(link => link.getAttribute("aria-current") === "page")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Latest" })).toHaveAttribute("href", "/creators?view=latest");
});
