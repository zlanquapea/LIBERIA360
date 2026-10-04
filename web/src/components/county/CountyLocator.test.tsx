import { screen } from '@testing-library/react';
import { renderWithMessages as render } from '@/test/render-with-messages';
import { CountyLocator } from './CountyLocator';
import { COUNTY_TILES } from '@/lib/county-tiles';
import { COUNTY_CAPITALS, countyCapital } from '@/lib/county-facts';
import type { County } from '@/lib/types';

const counties = COUNTY_TILES.map(
  (tile) => ({ id: tile.slug, slug: tile.slug, name: tile.slug.replace(/-/g, ' '), rolloutStage: 1, icon: null, emergencyNumber: null, safetyTips: [], localCustoms: null }) as County,
);

describe('CountyLocator', () => {
  it('links every county and marks the current one', () => {
    render(<CountyLocator counties={counties} currentSlug="margibi" />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(15);
    const current = links.filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', '/counties/margibi');
  });
});

describe('county capitals', () => {
  it('has a capital for each of the 15 counties', () => {
    for (const tile of COUNTY_TILES) expect(countyCapital(tile.slug)).toBeTruthy();
    expect(Object.keys(COUNTY_CAPITALS)).toHaveLength(15);
    expect(countyCapital('grand-bassa')).toBe('Buchanan');
    expect(countyCapital('nowhere')).toBeNull();
  });
});
