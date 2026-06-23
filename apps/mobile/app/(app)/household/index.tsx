import { View } from 'react-native';
import { HouseholdSettings } from '../../../src/features/households/HouseholdSettings';
import { useTheme } from '../../../src/theme/useTheme';

export default function HouseholdScreen() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <HouseholdSettings />
    </View>
  );
}
