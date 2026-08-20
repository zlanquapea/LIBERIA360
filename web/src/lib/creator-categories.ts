import type { CreatorCategory } from './types';

// Shared between the directory filter and the creator dashboard's profile
// editor — same list, same reason CREATOR_TYPES/TRAVELER_TYPES etc. are
// defined once in ProfileFields.tsx rather than redeclared per call site.
export const CREATOR_CATEGORIES: CreatorCategory[] = [
  'photographer',
  'videographer',
  'tour_guide',
  'tour_operator',
  'artist',
  'chef',
  'cultural',
  'other',
];
