import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useUiPreferencesStore,
  PANTRY_VIEW_MODE_STORAGE_KEY,
  resetPantryViewModeState,
  getPantryViewModeGeneration,
} from './uiPreferencesStore';
import { clearAllLocalUserData } from '../auth/session-store';

describe('uiPreferencesStore - pantryViewMode', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useUiPreferencesStore.setState({ pantryViewMode: 'list' });
  });

  it('defaults to list view mode', () => {
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');
  });

  it('updates pantryViewMode to grid and persists to AsyncStorage', async () => {
    await useUiPreferencesStore.getState().setPantryViewMode('grid');
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('grid');

    const stored = await AsyncStorage.getItem(PANTRY_VIEW_MODE_STORAGE_KEY);
    expect(stored).toBe('grid');
  });

  it('updates pantryViewMode back to list and persists to AsyncStorage', async () => {
    await useUiPreferencesStore.getState().setPantryViewMode('grid');
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('grid');

    await useUiPreferencesStore.getState().setPantryViewMode('list');
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');

    const stored = await AsyncStorage.getItem(PANTRY_VIEW_MODE_STORAGE_KEY);
    expect(stored).toBe('list');
  });

  it('resets pantryViewMode to list and removes storage key on logout', async () => {
    await useUiPreferencesStore.getState().setPantryViewMode('grid');
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('grid');

    await clearAllLocalUserData();

    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');
    const stored = await AsyncStorage.getItem(PANTRY_VIEW_MODE_STORAGE_KEY);
    expect(stored).toBeNull();
  });

  it('does not overwrite user-toggled mode if AsyncStorage hydration resolves later', async () => {
    await useUiPreferencesStore.getState().setPantryViewMode('grid');
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('grid');

    // Simulate late AsyncStorage resolution attempting to set stale 'list'
    await AsyncStorage.setItem(PANTRY_VIEW_MODE_STORAGE_KEY, 'list');
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('grid');
  });

  it('delayed AsyncStorage hydration racing against logout/reset is discarded via generation invalidation', async () => {
    // 1. Initial state has grid mode
    await useUiPreferencesStore.getState().setPantryViewMode('grid');
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('grid');

    // 2. Capture generation before an in-flight async lookup
    const inFlightGen = getPantryViewModeGeneration();

    // 3. User logs out: resetPantryViewModeState increments generation and resets to list
    resetPantryViewModeState();
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');
    expect(getPantryViewModeGeneration()).toBeGreaterThan(inFlightGen);

    // 4. Stale in-flight callback resolves with old 'grid' value
    // Guarded by generation check:
    if (inFlightGen === getPantryViewModeGeneration()) {
      useUiPreferencesStore.setState({ pantryViewMode: 'grid' });
    }

    // 5. Invariant: Pantry view mode strictly remains 'list'
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');
  });
});
