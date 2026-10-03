import { render, screen } from "@testing-library/react";
import { GuideDecisionCard } from "./GuideDecisionCard";
import type { GuideSummary, ExperienceSummary } from "../lib/api";
it("uses real prices, preserves free experiences, and explains request availability", () => {
  const guide = { guideType: "nature_guide", verificationStatus: "verified", languages: ["English"] } as GuideSummary;
  const experiences = [{ priceUsd: 15, category: "nature" }, { priceUsd: 0, category: "culture" }] as ExperienceSummary[];
  render(<GuideDecisionCard guide={guide} experiences={experiences} />);
  expect(screen.getByText("From US$ 0.00")).toBeInTheDocument();
  expect(screen.getByText(/sending a request does not confirm/)).toBeInTheDocument();
  expect(screen.getByText(/What does/)).toBeInTheDocument();
});
