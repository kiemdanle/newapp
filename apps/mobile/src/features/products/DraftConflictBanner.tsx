import { View, Text } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';

export interface DraftConflictBannerProps {
  currentVersion: number;
  /** A coordinator-backed form offers "keep my changes & retry" / "discard"
   * (the coordinator already has the local intent queued to reconcile). The
   * non-coordinator path has no queued intent to reconcile — refreshing just
   * re-fetches the server row so the next explicit Save has a current
   * version to send. */
  mode: 'coordinator' | 'refresh-only';
  busy: boolean;
  onRetry: () => void;
  onDiscard?: () => void;
}

/** Shared conflict UI for `ProductDraftForm` — split out to keep that file
 * under the project's ~200-line modularization guideline. */
export function DraftConflictBanner({ currentVersion, mode, busy, onRetry, onDiscard }: DraftConflictBannerProps) {
  const theme = useTheme();

  if (mode === 'refresh-only') {
    return (
      <View testID="draft-conflict-banner" style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.danger }}>
          This draft changed elsewhere (now at version {currentVersion}). Refresh before saving again — your typed
          text here is unaffected.
        </Text>
        <Button testID="draft-refresh" label={busy ? 'Refreshing…' : 'Refresh'} variant="outline" loading={busy} onPress={onRetry} />
      </View>
    );
  }

  return (
    <View testID="draft-conflict-banner" style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.danger }}>
        This draft changed elsewhere (now at version {currentVersion}). Your typed text here is unaffected — choose
        whether to keep it or take the latest saved version.
      </Text>
      <Button testID="draft-conflict-retry" label={busy ? 'Working…' : 'Keep my changes & retry'} variant="outline" loading={busy} onPress={onRetry} />
      <Button testID="draft-conflict-discard" label="Discard my changes" variant="ghost" disabled={busy} onPress={() => onDiscard?.()} />
    </View>
  );
}
