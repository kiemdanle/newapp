import { Pressable, Text, View } from 'react-native';
import { usePantryScope, type PantryScope } from '../../store/pantryScope';
import { useMyHouseholds } from '../../api/households';
import { useTheme } from '../../theme/useTheme';

export function ScopeToggle() {
  const theme = useTheme();
  const { data, isLoading } = useMyHouseholds();
  const { scope, householdId, setScope } = usePantryScope();

  const households = data?.items ?? [];
  const segments: Array<{ key: PantryScope; label: string; householdId?: string | null }> = [
    { key: 'personal', label: 'Personal' },
    ...households.map((h) => ({ key: 'household' as PantryScope, label: h.name, householdId: h.id })),
  ];

  if (segments.length <= 1) return null; // No households — only personal, no toggle needed.

  return (
    <View
      testID="scope-toggle"
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.bgElevated,
        borderRadius: theme.radii.md,
        padding: 2,
        marginHorizontal: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
      }}
    >
      {segments.map((seg) => {
        const active =
          scope === seg.key &&
          (seg.key === 'personal' || seg.householdId === householdId);
        return (
          <Pressable
            key={seg.key === 'personal' ? 'personal' : seg.householdId ?? seg.label}
            testID={`scope-toggle-${seg.key === 'personal' ? 'personal' : seg.householdId}`}
            accessibilityRole="button"
            onPress={() => setScope(seg.key, seg.householdId)}
            style={{
              flex: 1,
              paddingVertical: theme.spacing.sm,
              alignItems: 'center',
              borderRadius: theme.radii.md - 2,
              backgroundColor: active ? theme.colors.primary : 'transparent',
            }}
          >
            <Text
              style={{
                color: active ? theme.colors.primaryFg : theme.colors.textMuted,
                fontSize: 13,
                fontWeight: active ? '600' : '400',
              }}
              numberOfLines={1}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
