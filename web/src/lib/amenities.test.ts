import { AMENITY_PRESETS, iconForAmenity } from './amenities';
import { MdWifi } from 'react-icons/md';

describe('iconForAmenity', () => {
  it('resolves a preset label to its own icon, case-insensitively', () => {
    expect(iconForAmenity('WiFi')).toBe(MdWifi);
    expect(iconForAmenity('wifi')).toBe(MdWifi);
    expect(iconForAmenity('  WiFi  ')).toBe(MdWifi);
  });

  it('resolves every preset to a distinct-enough icon (all defined)', () => {
    for (const { label, icon } of AMENITY_PRESETS) {
      expect(iconForAmenity(label)).toBe(icon);
    }
  });

  it('falls back to a generic icon for an unrecognized/custom amenity', () => {
    expect(iconForAmenity('Rooftop bar with a view')).toBeDefined();
    expect(iconForAmenity('Rooftop bar with a view')).not.toBe(iconForAmenity('WiFi'));
  });
});
