import { fireEvent } from '@testing-library/react-native';
import { Share } from 'react-native';
import { InviteShareButton } from '../src/features/referral/InviteShareButton';
import { renderWithTheme } from '../tests/helpers/renderWithTheme';

it('invokes the native share sheet with the referral code', () => {
  const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
  const { getByText } = renderWithTheme(
    <InviteShareButton
      shareUrl="https://expyrico.app/invite?code=ABCDEF23"
      code="ABCDEF23"
    />,
    'expyrico',
  );
  fireEvent.press(getByText('Share invite'));
  // The code must be present — that is what the invited user enters at sign-up.
  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining('ABCDEF23') }),
  );
});
