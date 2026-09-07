// apps/mobile/app/(app)/pantry/history.tsx
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';
import { PantryHistoryView } from '../../../src/features/records/PantryHistoryView';

export default function PantryHistoryScreen() {
  const navigation = useNavigation<AppNavigationProp>();
  return <PantryHistoryView showBackHeader={true} onBack={() => navigation.goBack()} />;
}
