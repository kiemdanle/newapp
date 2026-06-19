import { ReferralCodeCard } from '../src/features/referral/ReferralCodeCard';
import { renderWithTheme } from '../tests/helpers/renderWithTheme';

it('renders the referral code text', () => {
  const { getByText } = renderWithTheme(
    <ReferralCodeCard
      code="ABCDEF23"
      shareUrl="https://expyrico.app/invite?code=ABCDEF23"
    />,
    'expyrico',
  );
  expect(getByText('ABCDEF23')).toBeTruthy();
});
