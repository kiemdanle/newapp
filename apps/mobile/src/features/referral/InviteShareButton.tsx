import React from 'react';
import { Share } from 'react-native';
import { Button } from '../../components/Button';

export function InviteShareButton({
  shareUrl,
  code,
}: {
  shareUrl: string;
  code: string;
}) {
  async function onShare() {
    // The CODE is the attribution mechanism (entered at sign-up). The URL is
    // included as readable text only — v1.x provisions no universal/app links,
    // so it does NOT auto-open the app or auto-attribute installs.
    await Share.share({
      message: `Join me on Expyrico! Enter my invite code ${code} when you sign up. ${shareUrl}`,
      url: shareUrl,
    });
  }

  return <Button label="Share invite" icon="share-social-outline" accessibilityLabel="Share invite" onPress={onShare} />;
}
