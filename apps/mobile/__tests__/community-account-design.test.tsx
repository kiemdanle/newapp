import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { GiveawayCard } from '../src/features/giveaways/GiveawayCard';
import SettingsIndex from '../app/(app)/settings/index';
import Profile from '../app/(app)/(tabs)/profile';
import { GiveawayStatusBadge } from '../src/features/giveaways/GiveawayStatusBadge';
import { renderWithTheme } from '../tests/helpers/renderWithTheme';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

const giveaway = {
  id: 'g-1',
  giverUserId: 'u-1',
  title: 'Fresh bread',
  description: 'Collect today',
  locationText: 'District 1',
  country: null,
  status: 'open' as const,
  claimCount: 2,
  selectedRecipientId: null,
  claimExpiresAt: null,
  completedAt: null,
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
};

describe('community and account Expyrico surfaces', () => {
  it('renders a semantic giveaway card with a visible status badge', () => {
    const { getByLabelText, getByText } = render(wrap(<GiveawayCard giveaway={giveaway} />));
    expect(getByLabelText('giveaway-g-1')).toBeTruthy();
    expect(getByText('Open')).toBeTruthy();
    expect(getByText(/District 1/)).toBeTruthy();
  });

  it.each(['expyrico', 'expyricoDark'] as const)('keeps status badges readable in %s mode', (themeId) => {
    const { getByText } = renderWithTheme(<GiveawayStatusBadge status="open" />, themeId);
    expect(getByText('Open')).toBeTruthy();
  });

  it('groups settings and exposes the Appearance control', () => {
    const { getByText, getByTestId } = render(wrap(<SettingsIndex />));
    expect(getByText('App preferences')).toBeTruthy();
    expect(getByTestId('settings-row-theme')).toBeTruthy();
    expect(getByText('Appearance')).toBeTruthy();
  });

  it('gives the profile account controls accessible labels', () => {
    const { getByLabelText } = render(wrap(<Profile />));
    expect(getByLabelText('Open settings')).toBeTruthy();
    expect(getByLabelText('Sign out of Expyrico')).toBeTruthy();
  });
});
