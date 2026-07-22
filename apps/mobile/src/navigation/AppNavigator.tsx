import React from 'react';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TabsNavigator } from './TabsNavigator';
import SettingsIndexScreen from '../../app/(app)/settings/index';
import SettingsThemeScreen from '../../app/(app)/settings/theme';
import SettingsAddPasskeyScreen from '../../app/(app)/settings/add-passkey';
import InviteScreen from '../../app/(app)/invite';
import HouseholdScreen from '../../app/(app)/household/index';
import ProductScreen from '../../app/(app)/product/[id]';
import ProductNewScreen from '../../app/(app)/product/new';
import ProductReviewScreen from '../../app/(app)/product/[id]/review';
import DealScreen from '../../app/(app)/deal/[id]';
import DealNewScreen from '../../app/(app)/deal/new';
import GiveawayScreen from '../../app/(app)/giveaway/[id]';
import GiveawayNewScreen from '../../app/(app)/giveaway/new';
import GiveawayMineScreen from '../../app/(app)/giveaway/mine';
import GiveawayManageScreen from '../../app/(app)/giveaway/[id]/manage';
import GiveawayRateScreen from '../../app/(app)/giveaway/[id]/rate';
import RecordScreen from '../../app/(app)/record/[id]';
import ReportScreen from '../../app/(app)/report/index';
import ScanScreen from '../../app/(app)/scan';

export type AppStackParamList = {
  Tabs: undefined;
  SettingsIndex: undefined;
  SettingsTheme: undefined;
  SettingsAddPasskey: undefined;
  Invite: undefined;
  Household: undefined;
  Product: { id: string };
  ProductNew: { barcode?: string; qr?: string } | undefined;
  ProductReview: { id: string };
  Deal: { id: string };
  DealNew: { editId?: string } | undefined;
  Giveaway: { id: string };
  GiveawayNew: undefined;
  GiveawayMine: undefined;
  GiveawayManage: { id: string };
  GiveawayRate: { id: string };
  Record: { id: string };
  Report: { targetType: string; targetId: string };
  Scan: undefined;
};

export type AppNavigationProp = NativeStackNavigationProp<AppStackParamList>;

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabsNavigator} />
      <Stack.Screen name="SettingsIndex" component={SettingsIndexScreen} options={{ headerShown: true, title: 'Settings' }} />
      <Stack.Screen name="SettingsTheme" component={SettingsThemeScreen} options={{ headerShown: true, title: 'Theme' }} />
      <Stack.Screen name="SettingsAddPasskey" component={SettingsAddPasskeyScreen} options={{ headerShown: true, title: 'Add a passkey' }} />
      <Stack.Screen name="Invite" component={InviteScreen} />
      {/* Body has no back control; native header provides Navigate up. */}
      <Stack.Screen name="Household" component={HouseholdScreen} options={{ headerShown: true, title: 'Household' }} />
      <Stack.Screen name="Product" component={ProductScreen} />
      <Stack.Screen name="ProductNew" component={ProductNewScreen} />
      <Stack.Screen name="ProductReview" component={ProductReviewScreen} />
      <Stack.Screen name="Deal" component={DealScreen} />
      <Stack.Screen name="DealNew" component={DealNewScreen} options={{ headerShown: true, title: 'Post a deal' }} />
      {/* Native headers restore the only back affordance on these stack screens
          (body content does not render a back control of its own). */}
      <Stack.Screen name="Giveaway" component={GiveawayScreen} options={{ headerShown: true, title: 'Giveaway' }} />
      <Stack.Screen name="GiveawayNew" component={GiveawayNewScreen} options={{ headerShown: true, title: 'List a free item' }} />
      <Stack.Screen name="GiveawayMine" component={GiveawayMineScreen} options={{ headerShown: true, title: 'My giveaways' }} />
      <Stack.Screen name="GiveawayManage" component={GiveawayManageScreen} options={{ headerShown: true, title: 'Manage claims' }} />
      <Stack.Screen name="GiveawayRate" component={GiveawayRateScreen} options={{ headerShown: true, title: 'Rate transaction' }} />
      <Stack.Screen name="Record" component={RecordScreen} options={{ headerShown: true, title: 'Pantry item' }} />
      <Stack.Screen name="Report" component={ReportScreen} options={{ headerShown: true, title: 'Report' }} />
      <Stack.Screen name="Scan" component={ScanScreen} />
    </Stack.Navigator>
  );
}
