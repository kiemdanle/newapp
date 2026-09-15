import { Alert } from 'react-native';
import {
  useAlertStore,
  showAlert,
  dismissAlert,
  resolveAlertMeta,
  installAppAlertInterceptor,
  uninstallAppAlertInterceptor,
} from './alertStore';

describe('alertStore & resolveAlertMeta', () => {
  beforeEach(() => {
    useAlertStore.setState({ current: null });
  });

  afterEach(() => {
    uninstallAppAlertInterceptor();
  });

  describe('resolveAlertMeta tone and icon resolution', () => {
    it('resolves danger tone and trash icon for deletion alerts', () => {
      const meta = resolveAlertMeta('Delete Item', 'Are you sure you want to delete this item?');
      expect(meta.tone).toBe('danger');
      expect(meta.icon).toBe('trash-outline');
    });

    it('resolves danger tone when a button has destructive style', () => {
      const meta = resolveAlertMeta('Confirm Action', 'Proceed?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive' },
      ]);
      expect(meta.tone).toBe('danger');
    });

    it('resolves danger tone and close-circle icon for discard/cancel alerts', () => {
      const meta = resolveAlertMeta('Discard unsaved changes?', "Your edits haven't been saved.");
      expect(meta.tone).toBe('danger');
      expect(meta.icon).toBe('close-circle-outline');
    });

    it('resolves danger tone and alert-circle icon for error alerts', () => {
      const meta = resolveAlertMeta('Validation Error', 'Description is too short.');
      expect(meta.tone).toBe('danger');
      expect(meta.icon).toBe('alert-circle-outline');
    });

    it('resolves warning tone and warning icon for limit reached alerts', () => {
      const meta = resolveAlertMeta('Stash Limit Reached', 'You have reached maximum items.');
      expect(meta.tone).toBe('warning');
      expect(meta.icon).toBe('warning-outline');
    });

    it('resolves warning tone and wifi icon for network required alerts', () => {
      const meta = resolveAlertMeta('Network Required', 'Internet connection required to proceed.');
      expect(meta.tone).toBe('warning');
      expect(meta.icon).toBe('wifi-outline');
    });

    it('resolves success tone and checkmark icon for success/update alerts', () => {
      const meta = resolveAlertMeta('Profile Updated', 'Your profile has been saved.');
      expect(meta.tone).toBe('success');
      expect(meta.icon).toBe('checkmark-circle-outline');
    });

    it('resolves danger tone and log-out icon for sign out alerts', () => {
      const meta = resolveAlertMeta('Sign Out', 'Are you sure you want to sign out?');
      expect(meta.tone).toBe('danger');
      expect(meta.icon).toBe('log-out-outline');
    });

    it('resolves info tone and images icon for photo alerts', () => {
      const meta = resolveAlertMeta('Profile Photo', 'Select an option');
      expect(meta.tone).toBe('info');
      expect(meta.icon).toBe('images-outline');
    });

    it('resolves default tone and notifications icon for general alerts', () => {
      const meta = resolveAlertMeta('Notification', 'Here is an announcement');
      expect(meta.tone).toBe('default');
      expect(meta.icon).toBe('notifications-outline');
    });

    it('honors explicit custom tone and icon overrides', () => {
      const meta = resolveAlertMeta(
        'Custom Alert',
        'Custom message',
        [],
        { tone: 'success', icon: 'sparkles-outline' },
      );
      expect(meta.tone).toBe('success');
      expect(meta.icon).toBe('sparkles-outline');
    });
  });

  describe('store show & dismiss', () => {
    it('sets current alert payload in store on show and clears on hide', () => {
      showAlert('Welcome!', 'Glad to see you.');
      const current = useAlertStore.getState().current;
      expect(current).not.toBeNull();
      expect(current?.title).toBe('Welcome!');
      expect(current?.message).toBe('Glad to see you.');
      expect(current?.buttons.length).toBe(1);
      expect(current?.buttons[0]?.text).toBe('OK');

      dismissAlert();
      expect(useAlertStore.getState().current).toBeNull();
    });
  });

  describe('installAppAlertInterceptor', () => {
    it('intercepts standard Alert.alert and populates alert store', () => {
      installAppAlertInterceptor();

      const onConfirm = jest.fn();
      Alert.alert(
        'Delete Item',
        'Are you sure you want to delete?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onConfirm },
        ],
      );

      const current = useAlertStore.getState().current;
      expect(current).not.toBeNull();
      expect(current?.title).toBe('Delete Item');
      expect(current?.tone).toBe('danger');
      expect(current?.icon).toBe('trash-outline');
      expect(current?.buttons.length).toBe(2);
    });
  });
});
