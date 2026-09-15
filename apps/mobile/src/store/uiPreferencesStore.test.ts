import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useUiPreferencesStore,
  PANTRY_VIEW_MODE_STORAGE_KEY,
  resetPantryViewModeState,
  hydratePantryViewModeFromStorage,
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

    // 2. Mock AsyncStorage.getItem with a controlled deferred promise for PANTRY_VIEW_MODE_STORAGE_KEY
    let resolveDelayedItem!: (val: string | null) => void;
    const delayedPromise = new Promise<string | null>((resolve) => {
      resolveDelayedItem = resolve;
    });
    const getItemSpy = jest.spyOn(AsyncStorage, 'getItem').mockImplementation((key) => {
      if (key === PANTRY_VIEW_MODE_STORAGE_KEY) {
        return delayedPromise;
      }
      return Promise.resolve(null);
    });
    try {
      // 3. Initiate real production hydration from storage (suspended on delayedPromise)
      const hydrationPromise = hydratePantryViewModeFromStorage();
      expect(getItemSpy).toHaveBeenCalledWith(PANTRY_VIEW_MODE_STORAGE_KEY);

      // 4. User logs out while hydration is in flight: resetPantryViewModeState runs
      resetPantryViewModeState();
      expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');

      // 5. Delayed AsyncStorage.getItem finally resolves with the old 'grid' value
      resolveDelayedItem('grid');
      await hydrationPromise;

      // 6. Invariant: The real hydratePantryViewModeFromStorage ran, checked generation,
      // and discarded the stale 'grid' result! Pantry view mode remains 'list'.
      expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');
    } finally {
      getItemSpy.mockRestore();
    }
  });

  it('toggles pantryViewMode synchronously and persists next mode', async () => {
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');

    const next1 = useUiPreferencesStore.getState().togglePantryViewMode();
    expect(next1).toBe('grid');
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('grid');

    const next2 = useUiPreferencesStore.getState().togglePantryViewMode();
    expect(next2).toBe('list');
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');
  });

  it('rapid double-toggle preserves second toggle destination without dropping toggle', async () => {
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');

    // Rapid double toggle in the same microtask
    useUiPreferencesStore.getState().togglePantryViewMode();
    useUiPreferencesStore.getState().togglePantryViewMode();

    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');
  });
});
