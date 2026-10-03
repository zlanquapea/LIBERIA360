import { screen } from '@testing-library/react';
import { renderWithMessages } from '@/test/render-with-messages';
import { PlaceProvenance } from './PlaceProvenance';

const recent = new Date(Date.now() - 10 * 86_400_000).toISOString();
const old = new Date(Date.now() - 400 * 86_400_000).toISOString();

describe('PlaceProvenance', () => {
  it('says plainly when nothing about the details is recorded', () => {
    renderWithMessages(
      <PlaceProvenance
        place={{ practicalInfoSource: null, practicalInfoCheckedAt: null, ownerUserId: null }}
        verificationStatus="unverified"
      />,
    );
    expect(screen.getByText('Not yet verified by LIBERIA360')).toBeInTheDocument();
    expect(screen.getByText(/isn't recorded/)).toBeInTheDocument();
    expect(screen.getByText(/call ahead/)).toBeInTheDocument();
  });

  it('labels a community submission and shows its source and date', () => {
    renderWithMessages(
      <PlaceProvenance
        place={{ practicalInfoSource: 'community', practicalInfoCheckedAt: recent, ownerUserId: 'u1' }}
        verificationStatus="unverified"
      />,
    );
    expect(screen.getByText(/Community submission/)).toBeInTheDocument();
    expect(screen.getByText(/shared by the community · last checked/)).toBeInTheDocument();
    expect(screen.queryByText(/call ahead/)).not.toBeInTheDocument();
  });

  it('separates platform verification from the details being stale', () => {
    renderWithMessages(
      <PlaceProvenance
        place={{ practicalInfoSource: 'liberia360_team', practicalInfoCheckedAt: old, ownerUserId: null }}
        verificationStatus="verified"
      />,
    );
    expect(screen.getByText('Verified by LIBERIA360')).toBeInTheDocument();
    expect(screen.getByText(/call ahead/)).toBeInTheDocument();
  });
});
