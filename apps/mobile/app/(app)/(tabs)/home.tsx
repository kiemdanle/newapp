import { View, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { RecordList } from '../../../src/features/records/RecordList';
import { useTheme } from '../../../src/theme/useTheme';

export default function HomeTab() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <RecordList />
      <Pressable accessibilityRole="button"
        testID="home-fab-add"
        onPress={() => router.push('/scan')}
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
        <Text style={{ color: theme.colors.primaryFg, fontSize: theme.typeRamp.headlineMedium.fontSize, lineHeight: theme.typeRamp.headlineMedium.lineHeight }}>+</Text>
      </Pressable>
    </View>
  );
}
