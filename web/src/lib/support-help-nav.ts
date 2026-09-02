import type { ComponentType, SVGProps } from 'react';
import { BookOpenIcon, LifebuoyIcon, NewspaperIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

export interface SupportHelpNavItem {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // A sub-route (an article, a post, a ticket thread) still belongs to
  // its section's tab — match on prefix, not exact path.
  match: (pathname: string) => boolean;
}

// One list drives the tab strip on every Help Center / FAQ / Blog /
// Customer Support page, so a visitor can move between "read about it
// myself" and "ask a person" without a trip back through the account
// dashboard. Mirrors the same one-list-drives-the-nav pattern as
// business-dashboard-nav.ts.
export const SUPPORT_HELP_NAV: SupportHelpNavItem[] = [
  { key: 'help', label: 'Help Center', href: '/help', icon: BookOpenIcon, match: (p) => p.startsWith('/help') },
  { key: 'faq', label: 'FAQ', href: '/faq', icon: QuestionMarkCircleIcon, match: (p) => p === '/faq' },
  { key: 'blog', label: 'Blog & Updates', href: '/blog', icon: NewspaperIcon, match: (p) => p.startsWith('/blog') },
  {
    key: 'support',
    label: 'My Tickets',
    href: '/account/support',
    icon: LifebuoyIcon,
    match: (p) => p.startsWith('/account/support'),
  },
];
