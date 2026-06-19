import { View, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { RecordList } from '../../../src/features/records/RecordList';
import { ScopeToggle } from '../../../src/features/households/ScopeToggle';
import { useTheme } from '../../../src/theme/useTheme';
import { MD3FAB } from '../../../src/components/MD3FAB';

/**
 * Theme-adaptive FAB. When the active theme is material, renders
 * `<MD3FAB>`. Expyrico / Bento / Clay keep the existing Pressable.
 */
function HomeFAB({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  if (theme.id === 'material') {
    return <MD3FAB icon="add" onPress={onPress} accessibilityLabel="Scan" />;
  }
  return (
    <Pressable
      accessibilityRole="button"
      testID="home-fab-add"
      onPress={onPress}
      style={{
        position: 'absolute',
        right: theme.spacing.xl,
        bottom: theme.spacing.xxl,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.radii.pill,
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: theme.colors.primaryFg,
          fontSize: theme.typeRamp.headlineMedium.fontSize,
          lineHeight: theme.typeRamp.headlineMedium.lineHeight,
        }}
      >
        +
      </Text>
    </Pressable>
  );
}

export default function HomeTab() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScopeToggle />
      <RecordList />
      <HomeFAB onPress={() => router.push('/scan')} />
    </View>
  );
}
