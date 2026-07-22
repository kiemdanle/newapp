import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import WelcomeScreen from '../../app/(auth)/welcome';
import SignInScreen from '../../app/(auth)/sign-in';
import SignUpScreen from '../../app/(auth)/sign-up';
import ForgotPasswordScreen from '../../app/(auth)/forgot-password';
import ResetPasswordScreen from '../../app/(auth)/reset-password';
import VerifyEmailScreen from '../../app/(auth)/verify-email';
import VerifyResetCodeScreen from '../../app/(auth)/verify-reset-code';

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: { ticket?: string } | undefined;
  VerifyEmail: { email?: string } | undefined;
  VerifyResetCode: { email?: string } | undefined;
};

export type AuthStackNavigationProp = NativeStackNavigationProp<AuthStackParamList>;

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="VerifyResetCode" component={VerifyResetCodeScreen} />
    </Stack.Navigator>
  );
}
