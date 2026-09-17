import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: Record<string, unknown>) {
  if (!navigationRef.isReady()) return;

  const tabScreens = new Set(['Home', 'Giveaways', 'Deals', 'Reviews', 'Profile']);
  const authScreens = new Set(['Welcome', 'SignIn', 'SignUp', 'ForgotPassword', 'ResetPassword', 'VerifyEmail', 'VerifyResetCode']);

  if (tabScreens.has(name)) {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'App',
        params: {
          screen: 'Tabs',
          params: {
            screen: name,
            params,
          },
        },
      }),
    );
  } else if (authScreens.has(name)) {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'Auth',
        params: {
          screen: name,
          params,
        },
      }),
    );
  } else {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'App',
        params: {
          screen: name,
          params,
        },
      }),
    );
  }
}
