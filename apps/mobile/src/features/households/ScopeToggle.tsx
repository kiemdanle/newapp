import { Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { navigate } from '../../navigation/navigationRef';
import { usePantryScope, type PantryScope } from '../../store/pantryScope';
import { useMyHouseholds } from '../../api/households';
import { useTheme } from '../../theme/useTheme';

export function ScopeToggle() {
  const theme = useTheme();
  const { data } = useMyHouseholds();
  const { scope, householdId, setScope } = usePantryScope();

  const households = data?.items ?? [];
  if (households.length === 0) {
    return (
      <View style={{ marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
        <Pressable
          testID="scope-toggle-discovery-cta"
          accessibilityRole="button"
          accessibilityLabel="Share pantry with family or roommates"
          onPress={() => navigate('Household')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.bgElevated,
            borderWidth: 1,
            borderColor: theme.colors.border,
            minHeight: 44,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 13,
              fontWeight: '600',
            }}
          >
            Share pantry with family or roommates
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  const segments: Array<{ key: PantryScope; label: string; householdId?: string | null }> = [
    { key: 'all', label: 'All' },
    { key: 'personal', label: 'Personal' },
    ...households.map((household) => ({
      key: 'household' as const,
      label: household.name,
      householdId: household.id,
    })),
  ];
  const usesScrollingLayout = segments.length > 3;

  const segmentButtons = segments.map((segment) => {
    const active =
      scope === segment.key &&
      (segment.key !== 'household' || segment.householdId === householdId);
    return (
      <Pressable
        key={segment.householdId ?? segment.key}
        testID={`scope-toggle-${segment.key === 'household' ? segment.householdId : segment.key}`}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`Filter pantry: ${segment.label}`}
        onPress={() => setScope(segment.key, segment.householdId ?? null)}
        style={({ pressed }) => ({
          flex: usesScrollingLayout ? undefined : 1,
          minWidth: usesScrollingLayout ? 84 : undefined,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: theme.radii.md - 2,
          backgroundColor: active ? theme.colors.primary : 'transparent',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: active ? theme.colors.primaryFg : theme.colors.textMuted,
            fontSize: 13,
            fontWeight: active ? '700' : '400',
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {segment.label}
        </Text>
      </Pressable>
    );
  });

  return (
    <View
      testID="scope-toggle"
      style={{
        backgroundColor: theme.colors.bgElevated,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 2,
        marginHorizontal: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
      }}
    >
      {!usesScrollingLayout ? (
        <View style={{ flexDirection: 'row' }}>{segmentButtons}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', flexGrow: 1 }}
        >
          {segmentButtons}
        </ScrollView>
      )}
    </View>
  );
}
