import { fireEvent, render, screen } from '@testing-library/react';
import { renderWithMessages } from '@/test/render-with-messages';
import { MobileFilterSheet, DropdownOption, PRICE_BUCKETS, priceBucketLabelKey } from './MobileFilterSheet';
import enMessages from '../../messages/en.json';
import type { Category, County } from '@/lib/types';

// PRICE_BUCKETS carries no `label` of its own since i18n Phase 3 — each
// bucket's display text now comes from common.priceBucket* via
// priceBucketLabelKey, so tests read the same English strings from
// en.json rather than a hardcoded copy that could drift from it.
function priceBucketLabel(bucketId: string): string {
  return (enMessages.common as Record<string, string>)[priceBucketLabelKey(bucketId)];
}

const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Food & Dining', slug: 'food-dining', description: null, icon: 'CakeIcon' },
  { id: 'c2', name: 'Hotels & Lodges', slug: 'hotels-lodges', description: null, icon: 'HomeIcon' },
];

const COUNTIES: County[] = [
  {
    id: 'co1',
    name: 'Montserrado',
    slug: 'montserrado',
    rolloutStage: 1,
    icon: null,
    emergencyNumber: null,
    safetyTips: [],
    localCustoms: null,
  },
];

function baseProps(overrides: Partial<Parameters<typeof MobileFilterSheet>[0]> = {}) {
  return {
    open: true,
    onClose: jest.fn(),
    categories: CATEGORIES,
    activeSlugs: new Set(CATEGORIES.map((c) => c.slug)),
    allCategoriesActive: true,
    onToggleCategory: jest.fn(),
    onSelectAllCategories: jest.fn(),
    counties: COUNTIES,
    countySlug: null,
    onSelectCounty: jest.fn(),
    openNowOnly: false,
    onToggleOpenNow: jest.fn(),
    priceBucketId: '',
    onSelectPriceBucket: jest.fn(),
    hasActiveFilters: false,
    onClear: jest.fn(),
    resultCount: 7,
    ...overrides,
  };
}

describe('MobileFilterSheet', () => {
  it('renders nothing when closed', () => {
    renderWithMessages(<MobileFilterSheet {...baseProps({ open: false })} />);
    expect(screen.queryByRole('dialog', { name: 'Filter places' })).not.toBeInTheDocument();
  });

  it('lists every category, county, and price bucket, plus the live result count', () => {
    renderWithMessages(<MobileFilterSheet {...baseProps()} />);

    expect(screen.getByRole('dialog', { name: 'Filter places' })).toBeInTheDocument();
    expect(screen.getByText('Food & Dining')).toBeInTheDocument();
    expect(screen.getByText('Hotels & Lodges')).toBeInTheDocument();
    expect(screen.getByText('Montserrado')).toBeInTheDocument();
    for (const bucket of PRICE_BUCKETS) {
      expect(screen.getByText(priceBucketLabel(bucket.id))).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Show 7 places' })).toBeInTheDocument();
  });

  it('uses singular "place" for a result count of exactly one', () => {
    renderWithMessages(<MobileFilterSheet {...baseProps({ resultCount: 1 })} />);
    expect(screen.getByRole('button', { name: 'Show 1 place' })).toBeInTheDocument();
  });

  it('calls onToggleCategory, onSelectCounty, onToggleOpenNow, and onSelectPriceBucket from their respective controls', () => {
    const onToggleCategory = jest.fn();
    const onSelectCounty = jest.fn();
    const onToggleOpenNow = jest.fn();
    const onSelectPriceBucket = jest.fn();
    renderWithMessages(
      <MobileFilterSheet
        {...baseProps({ onToggleCategory, onSelectCounty, onToggleOpenNow, onSelectPriceBucket })}
      />,
    );

    fireEvent.click(screen.getByLabelText('Food & Dining'));
    fireEvent.click(screen.getByText('Montserrado'));
    fireEvent.click(screen.getByRole('button', { name: 'Open now' }));
    fireEvent.click(screen.getByText('Free'));

    expect(onToggleCategory).toHaveBeenCalledWith('food-dining');
    expect(onSelectCounty).toHaveBeenCalledWith('montserrado');
    expect(onToggleOpenNow).toHaveBeenCalled();
    expect(onSelectPriceBucket).toHaveBeenCalledWith('free');
  });

  it('shows "Clear all" only when a filter is active, and calls onClear when clicked', () => {
    const onClear = jest.fn();
    const { rerender } = renderWithMessages(<MobileFilterSheet {...baseProps({ hasActiveFilters: false, onClear })} />);
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();

    rerender(<MobileFilterSheet {...baseProps({ hasActiveFilters: true, onClear })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('closes on Escape, on the backdrop, and via the close/show-results buttons', () => {
    const onClose = jest.fn();
    renderWithMessages(<MobileFilterSheet {...baseProps({ onClose })} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Show 7 places' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('DropdownOption', () => {
  it('renders its label and calls onClick when pressed', () => {
    const onClick = jest.fn();
    render(<DropdownOption label="All counties" selected={false} onClick={onClick} />);
    fireEvent.click(screen.getByText('All counties'));
    expect(onClick).toHaveBeenCalled();
  });
});
