/**
 * Capital city of each of Liberia's 15 counties, keyed by county slug.
 * Static reference data (these don't change), shown on the county page
 * so a visitor knows which town anchors the county — usually where the
 * buses go, the fuel is, and the county offices sit.
 */
export const COUNTY_CAPITALS: Readonly<Record<string, string>> = {
  bomi: 'Tubmanburg',
  bong: 'Gbarnga',
  gbarpolu: 'Bopolu',
  'grand-bassa': 'Buchanan',
  'grand-cape-mount': 'Robertsport',
  'grand-gedeh': 'Zwedru',
  'grand-kru': 'Barclayville',
  lofa: 'Voinjama',
  margibi: 'Kakata',
  maryland: 'Harper',
  montserrado: 'Bensonville',
  nimba: 'Sanniquellie',
  'river-cess': 'Cestos City',
  'river-gee': 'Fish Town',
  sinoe: 'Greenville',
};

export function countyCapital(slug: string): string | null {
  return COUNTY_CAPITALS[slug] ?? null;
}
