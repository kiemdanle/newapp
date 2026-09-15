import { Alert } from 'react-native';
import { create } from 'zustand';
import type Ionicons from 'react-native-vector-icons/Ionicons';

export type AlertTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export type AlertIconName = keyof typeof Ionicons.glyphMap;

export interface AppAlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  testID?: string;
}

export interface AppAlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
  icon?: AlertIconName;
  tone?: AlertTone;
}

export interface AlertPayload {
  id: string;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  options?: AppAlertOptions;
  tone: AlertTone;
  icon: AlertIconName;
}

interface AlertState {
  current: AlertPayload | null;
  show: (
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
    options?: AppAlertOptions,
  ) => void;
  hide: () => void;
}

/**
 * Derives a semantic tone and icon based on the alert content and button types.
 */
export function resolveAlertMeta(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  customOptions?: AppAlertOptions,
): { tone: AlertTone; icon: AlertIconName } {
  if (customOptions?.tone && customOptions?.icon) {
    return { tone: customOptions.tone, icon: customOptions.icon };
  }

  const lowerTitle = (title || '').toLowerCase();
  const lowerMsg = (message || '').toLowerCase();
  const fullText = `${lowerTitle} ${lowerMsg}`;
  const hasDestructiveBtn = buttons?.some((b) => b.style === 'destructive');
  // Sign out / Log out
  if (lowerTitle.includes('sign out') || lowerTitle.includes('log out')) {
    return {
      tone: customOptions?.tone ?? 'danger',
      icon: customOptions?.icon ?? 'log-out-outline',
    };
  }

  // Discard changes / Cancel action
  if (lowerTitle.includes('discard') || lowerTitle.includes('cancel giveaway') || lowerTitle.includes('leave household')) {
    return {
      tone: customOptions?.tone ?? 'danger',
      icon: customOptions?.icon ?? 'close-circle-outline',
    };
  }

  // Destructive / deletion
  if (lowerTitle.includes('delete') || lowerTitle.includes('remove') || lowerTitle.includes('dissolve')) {
    return {
      tone: customOptions?.tone ?? 'danger',
      icon: customOptions?.icon ?? 'trash-outline',
    };
  }

  // Media / Photo selection
  if (lowerTitle.includes('photo') || lowerTitle.includes('camera') || lowerTitle.includes('screenshot')) {
    return {
      tone: customOptions?.tone ?? 'info',
      icon: customOptions?.icon ?? 'images-outline',
    };
  }

  // Network / connection / offline
  if (fullText.includes('offline') || fullText.includes('network required') || fullText.includes('connection')) {
    return {
      tone: customOptions?.tone ?? 'warning',
      icon: customOptions?.icon ?? 'wifi-outline',
    };
  }

  // Error / failure
  if (lowerTitle.includes('error') || lowerTitle.includes('failed') || lowerTitle.includes('invalid')) {
    return {
      tone: customOptions?.tone ?? 'danger',
      icon: customOptions?.icon ?? 'alert-circle-outline',
    };
  }

  // Generic destructive button fallback
  if (hasDestructiveBtn) {
    return {
      tone: customOptions?.tone ?? 'danger',
      icon: customOptions?.icon ?? 'trash-outline',
    };
  }
  // Warnings & limits
  if (
    lowerTitle.includes('limit') ||
    lowerTitle.includes('warning') ||
    lowerTitle.includes('creator only') ||
    lowerTitle.includes('access required')
  ) {
    return {
      tone: customOptions?.tone ?? 'warning',
      icon: customOptions?.icon ?? 'warning-outline',
    };
  }


  // Media / Photo selection
  if (lowerTitle.includes('photo') || lowerTitle.includes('camera') || lowerTitle.includes('screenshot')) {
    return {
      tone: customOptions?.tone ?? 'info',
      icon: customOptions?.icon ?? 'images-outline',
    };
  }

  // Success / confirmations
  if (
    lowerTitle.includes('success') ||
    lowerTitle.includes('received') ||
    lowerTitle.includes('updated') ||
    lowerTitle.includes('welcome') ||
    lowerTitle.includes('saved') ||
    lowerTitle.includes('restored') ||
    lowerTitle.includes('moved')
  ) {
    return {
      tone: customOptions?.tone ?? 'success',
      icon: customOptions?.icon ?? 'checkmark-circle-outline',
    };
  }

  return {
    tone: customOptions?.tone ?? 'default',
    icon: customOptions?.icon ?? 'notifications-outline',
  };
}

export const useAlertStore = create<AlertState>((set) => ({
  current: null,
  show: (title, message, buttons, options) => {
    const finalButtons: AppAlertButton[] =
      buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];
    const { tone, icon } = resolveAlertMeta(title, message, finalButtons, options);
    const payload: AlertPayload = {
      id: Math.random().toString(36).substring(2, 9),
      title: title || '',
      message,
      buttons: finalButtons,
      options,
      tone,
      icon,
    };
    set({ current: payload });
  },
  hide: () => set({ current: null }),
}));

/**
 * Public helper to display a customized Expyrico alert.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  options?: AppAlertOptions,
) {
  useAlertStore.getState().show(title, message, buttons, options);
}

/**
 * Public helper to dismiss the currently displayed alert.
 */
export function dismissAlert() {
  useAlertStore.getState().hide();
}

/**
 * Installs the custom alert provider as the handler for React Native's `Alert.alert`.
 * This allows all existing and future calls to `Alert.alert` to automatically render
 * the modern Expyrico-branded dialog.
 */
let isInstalled = false;
const originalNativeAlert = Alert.alert;

export function installAppAlertInterceptor() {
  if (isInstalled) return;
  isInstalled = true;

  Alert.alert = (
    title: string,
    message?: string,
    buttons?: any[],
    options?: any,
  ) => {
    showAlert(title, message, buttons, options);
  };
}

export function uninstallAppAlertInterceptor() {
  if (!isInstalled) return;
  Alert.alert = originalNativeAlert;
  isInstalled = false;
}
