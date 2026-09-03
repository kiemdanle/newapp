import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Screen } from '../../../src/components/Screen';
import { RecordList } from '../../../src/features/records/RecordList';
import { UseNextHero } from '../../../src/features/records/UseNextHero';
import { ScopeToggle } from '../../../src/features/households/ScopeToggle';
import { useActiveRecords } from '../../../src/api/records';
import { groupRecords } from '../../../src/features/records/groupRecords';
import { useTheme } from '../../../src/theme/useTheme';
import { Logo } from '../../../src/components/Logo';

export default function HomeTab() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const records = useActiveRecords();
  const groups = groupRecords(records);
  const totalUrgent = groups.expired.length + groups.today.length + groups.thisWeek.length;
  const renderHeader = (isFiltered: boolean) => (
    <View style={styles.headerContent}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Logo size={28} />
          <View>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>Your pantry</Text>
            <Text style={[styles.headerSubcopy, { color: theme.colors.textMuted }]}>Use what you need first.</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {totalUrgent > 0 ? (
            <View style={[styles.countPill, { backgroundColor: theme.colors.accentLight }]}>
              <Text style={[styles.countText, { color: theme.colors.primaryDark }]}>{totalUrgent} need attention</Text>
            </View>
          ) : null}
          <Pressable
            testID="home-share-pantry-btn"
            accessibilityRole="button"
            accessibilityLabel="Share pantry with family or roommates"
            onPress={() => navigation.navigate('Household')}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.bgElevated,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons name="people-outline" size={20} color={theme.colors.primary} />
          </Pressable>
        </View>
      </View>
      <ScopeToggle />
      {records.length > 0 && !isFiltered ? <UseNextHero groups={groups} /> : null}
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
        <RecordList header={renderHeader} empty={empty} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: { gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
});
