import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { Button } from '../../../src/components/Button';
import { RecordList } from '../../../src/features/records/RecordList';
import { UseNextHero } from '../../../src/features/records/UseNextHero';
import { ScopeToggle } from '../../../src/features/households/ScopeToggle';
import { useActiveRecords } from '../../../src/api/records';
import { groupRecords } from '../../../src/features/records/groupRecords';
import { useTheme } from '../../../src/theme/useTheme';
import { Logo } from '../../../src/components/Logo';

export default function HomeTab() {
  const theme = useTheme();
  const router = useRouter();
  const records = useActiveRecords();
  const groups = groupRecords(records);
  const totalUrgent = groups.expired.length + groups.today.length + groups.thisWeek.length;
  const isEmpty = records.length === 0;

  const header = (
    <View style={styles.headerContent}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Logo size={28} />
          <View>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>Your pantry</Text>
            <Text style={[styles.headerSubcopy, { color: theme.colors.textMuted }]}>Use what needs you first.</Text>
          </View>
        </View>
        {totalUrgent > 0 ? <View style={[styles.countPill, { backgroundColor: theme.colors.accentLight }]}><Text style={[styles.countText, { color: theme.colors.primaryDark }]}>{totalUrgent} need attention</Text></View> : null}
      </View>
      <ScopeToggle />
      {!isEmpty ? <UseNextHero groups={groups} /> : null}
    </View>
  );

  const empty = (
    <View style={[styles.emptyCard, { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryLight, borderRadius: theme.radii.md }]}><Ionicons name="basket-outline" size={28} color={theme.colors.primaryDark} /></View>
      <Text style={[styles.emptyEyebrow, { color: theme.colors.primaryDark }]}>START FRESH</Text>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Start your pantry</Text>
      <Text style={[styles.emptyBody, { color: theme.colors.textMuted }]}>Scan the first item on your shelf and we’ll help you use it on time.</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Screen scroll={false} padded={false}>
        <RecordList header={header} empty={empty} />
      </Screen>
      <View testID="home-scan-action" style={styles.scanAction}>
        <Button label="Scan an item" icon="scan-outline" accessibilityLabel="Scan pantry items" onPress={() => router.push('/scan')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: { gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  greeting: { fontSize: 20, fontWeight: '700' },
  countPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  countText: { fontSize: 12, fontWeight: '700' },
  headerSubcopy: { fontSize: 13, marginTop: 2 },
  emptyCard: { alignItems: 'center', borderWidth: 1, gap: 10, padding: 24 },
  emptyIcon: { alignItems: 'center', height: 56, justifyContent: 'center', width: 56 },
  emptyEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 2 },
  emptyTitle: { fontSize: 24, fontWeight: '700' },
  emptyBody: { fontSize: 14, lineHeight: 20, maxWidth: 280, textAlign: 'center' },
  scanAction: { position: 'absolute', bottom: 94, left: 24, right: 24 },
});
