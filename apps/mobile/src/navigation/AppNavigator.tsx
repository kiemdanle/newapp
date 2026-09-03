import React from 'react';
import { Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TabsNavigator } from './TabsNavigator';
import SettingsIndexScreen from '../../app/(app)/settings/index';
import SettingsThemeScreen from '../../app/(app)/settings/theme';
import SettingsAddPasskeyScreen from '../../app/(app)/settings/add-passkey';
import InviteScreen from '../../app/(app)/invite';
import HouseholdScreen from '../../app/(app)/household/index';
import ProductScreen from '../../app/(app)/product/[id]';
import ProductNewScreen from '../../app/(app)/product/new';
import ProductDraftsScreen from '../../app/(app)/product/drafts';
import ProductReviewScreen from '../../app/(app)/product/[id]/review';
import ProductEditScreen from '../../app/(app)/product/[id]/edit';
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
import EditProfileScreen from '../../app/(app)/profile/edit';
import PasswordScreen from '../../app/(app)/profile/password';
import FeedbackHubScreen from '../../app/(app)/feedback/index';
import FeedbackDetailScreen from '../../app/(app)/feedback/[id]';

export type AppStackParamList = {
  Tabs: undefined;
  SettingsIndex: undefined;
  SettingsTheme: undefined;
  SettingsAddPasskey: undefined;
  Invite: undefined;
  Household: undefined;
  Product: { id: string };
  // `productId`/`resume` are set when scan.tsx routes here for an
  // `editable_private` (resume: 'edit') or `creator_pending` (resume:
  // 'pending') outcome — Phase 5 Task 4 wires the screen to actually consume
  // them; Task 3 only needs the navigation contract to exist and be typed.
  // `feedback` is only populated when navigating from the drafts list (which
  // already has moderationFeedback from GET /products/drafts) — the single-
  // product GET the editor otherwise resumes through deliberately excludes
  // it (server-side, moderation notes aren't part of the public product DTO).
  ProductNew: {
    barcode?: string;
    qr?: string;
    productId?: string;
    resume?: 'edit' | 'pending';
    feedback?: string;
    target?: 'pantry' | 'deal';
  } | undefined;
  ProductDrafts: undefined;
  ProductReview: { id: string };
  ProductEdit: { id: string };
  Deal: { id: string };
  DealNew: { editId?: string; productId?: string } | undefined;
  Giveaway: { id: string };
  GiveawayNew: undefined;
  GiveawayMine: undefined;
  GiveawayManage: { id: string };
  GiveawayRate: { id: string };
  Record: { id: string };
  Report: { targetType: string; targetId: string };
  Scan: { target?: 'pantry' | 'deal' } | undefined;
  ProfileEdit: undefined;
  ProfilePassword: undefined;
  FeedbackHub: { initialTab?: 'submit' | 'tickets' } | undefined;
  FeedbackDetail: { id: string };
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
      <Stack.Screen name="Product" component={ProductScreen} options={{ headerShown: true, title: 'Product Details' }} />
      <Stack.Screen name="ProductNew" component={ProductNewScreen} />
      <Stack.Screen name="ProductDrafts" component={ProductDraftsScreen} options={{ headerShown: true, title: 'My drafts' }} />
      <Stack.Screen name="ProductReview" component={ProductReviewScreen} />
      <Stack.Screen name="ProductEdit" component={ProductEditScreen} />
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
      <Stack.Screen name="ProfileEdit" component={EditProfileScreen} options={{ headerShown: true, title: 'Edit profile' }} />
      <Stack.Screen name="ProfilePassword" component={PasswordScreen} options={{ headerShown: true, title: 'Password & security' }} />
      <Stack.Screen name="FeedbackHub" component={FeedbackHubScreen} options={{ headerShown: true, title: 'Help & feedback' }} />
      <Stack.Screen name="FeedbackDetail" component={FeedbackDetailScreen} options={{ headerShown: true, title: 'Ticket details' }} />
    </Stack.Navigator>
  );
}
