import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMessages } from '@/test/render-with-messages';
import { SaveIconButton } from './SaveIconButton';

const toggle = jest.fn();
let saved = false;
jest.mock('../hooks/useSavedPlaces', () => ({
  useSavedPlaces: () => ({ isSaved: () => saved, toggle }),
}));
jest.mock('../lib/analytics-api', () => ({ recordAnalyticsEvent: jest.fn() }));

describe('SaveIconButton', () => {
  beforeEach(() => {
    toggle.mockReset();
    saved = false;
  });

  it('says "Snap! Saved" when a place is saved', async () => {
    toggle.mockReturnValue(true);
    renderWithMessages(<SaveIconButton slug="elwa-beach" placeId="p1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Save this place' }));
    expect(screen.getByRole('status')).toHaveTextContent('Snap! Saved');
  });

  it('stays quiet when a place is unsaved', async () => {
    saved = true;
    toggle.mockReturnValue(false);
    renderWithMessages(<SaveIconButton slug="elwa-beach" placeId="p1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove from saved places' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
