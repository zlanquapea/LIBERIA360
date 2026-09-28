import { render, screen } from "@testing-library/react";
import { FeatureNavigation } from "./FeatureNavigation";
let mockPathname = "/guides/sam";
jest.mock("../i18n/navigation", () => ({
  usePathname: () => mockPathname,
  Link: ({ href, children, ...props }: any) => <a href={`/fr${href}`} {...props}>{children}</a>,
}));
jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
it("marks the owning section active on nested pages", () => {
 render(<FeatureNavigation />);
 expect(screen.getByRole("link", { name: "guides" })).toHaveAttribute("aria-current", "page");
 expect(screen.getByRole("link", { name: "guides" })).toHaveAttribute("href", "/fr/guides");
 expect(screen.getByRole("link", { name: "creators" })).not.toHaveAttribute("aria-current");
});
it("does not match unrelated routes with a shared prefix", () => {
 mockPathname = "/trips-other";
 render(<FeatureNavigation />);
 expect(screen.getByRole("link", { name: "trips" })).not.toHaveAttribute("aria-current");
});
