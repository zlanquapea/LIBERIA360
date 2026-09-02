import type { ComponentType, SVGProps } from 'react';
import { BookOpenIcon, NewspaperIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

export interface HelpContentNavItem {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // A sub-route (an article, a post) still belongs to its section's tab —
  // match on prefix, not exact path.
  match: (pathname: string) => boolean;
}

// Help Center, FAQ, and Blog & Updates are one family: admin-authored,
// self-serve reading content with no login and no agent involved. This
// nav is deliberately scoped to just those three — it used to also
// include "My Tickets" plus an always-on "Submit a ticket" button, which
// made a private ticket conversation look like a fourth peer of these
// read-only pages instead of the separate system it actually is. The one
// correct link between the two directions stays where it always was:
// StillNeedHelp's "Contact Support" card, pointing one way, from content
// to the ticket flow — never the reverse.
export const HELP_CONTENT_NAV: HelpContentNavItem[] = [
  { key: 'help', label: 'Help Center', href: '/help', icon: BookOpenIcon, match: (p) => p.startsWith('/help') },
  { key: 'faq', label: 'FAQ', href: '/faq', icon: QuestionMarkCircleIcon, match: (p) => p === '/faq' },
  { key: 'blog', label: 'Blog & Updates', href: '/blog', icon: NewspaperIcon, match: (p) => p.startsWith('/blog') },
];
