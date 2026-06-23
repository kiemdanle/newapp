import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Logo size={32} withWordmark />
          {totalUrgent > 0 ? (
            <View style={[styles.countPill, { backgroundColor: theme.colors.accent + '20' }]}>
              <Text style={[styles.countText, { color: theme.colors.accent }]}>
                {totalUrgent} need attention
              </Text>
            </View>
          ) : null}
        </View>

        <ScopeToggle />

        <UseNextHero groups={groups} />

        <RecordList />
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        testID="home-fab-add"
        onPress={() => router.push('/scan')}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: pressed ? '#D8901A' : theme.colors.accent,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 100,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  countPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F5A623',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '400',
    marginTop: -2,
  },
});
