import type { AppNavigationProp } from '../../src/navigation/AppNavigator';
import type { AuthStackNavigationProp } from '../../src/navigation/AuthNavigator';

const appNavigation: AppNavigationProp = {
  navigate: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(),
  canGoBack: jest.fn(),
  getParent: jest.fn(),
  getId: jest.fn(),
  getState: jest.fn(),
  setParams: jest.fn(),
  addListener: jest.fn(() => () => undefined),
  removeListener: jest.fn(),
} as unknown as AppNavigationProp;

const authNavigation: AuthStackNavigationProp = appNavigation as unknown as AuthStackNavigationProp;

export function useNavigation() {
  return appNavigation;
}

export function useRoute() {
  return { params: __routeParams };
}

let __routeParams: Record<string, string> = {};

export function __setRouteParams(params: Record<string, string>) {
  __routeParams = params;
}

export const navigation = appNavigation;

export const router = {
  push: appNavigation.navigate,
  replace: appNavigation.replace,
  back: appNavigation.goBack,
};

export const appRouter = router;
export const authRouter = {
  push: authNavigation.navigate,
  replace: authNavigation.replace,
  back: authNavigation.goBack,
};

beforeEach(() => {
  __routeParams = {};
  jest.clearAllMocks();
});
