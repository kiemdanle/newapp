import { View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../../../src/navigation/AppNavigator';
import { HouseholdSettings } from '../../../src/features/households/HouseholdSettings';
import { useTheme } from '../../../src/theme/useTheme';

export default function HouseholdScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<AppStackParamList, 'Household'>>();
  const joinCode = route.params?.joinCode;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <HouseholdSettings initialJoinCode={joinCode} />
    </View>
  );
}
