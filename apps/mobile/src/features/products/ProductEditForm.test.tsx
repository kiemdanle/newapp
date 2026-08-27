import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Product, ProductEditRow } from '@expyrico/shared';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../theme/store';
import { ProductEditForm } from './ProductEditForm';
import type { ConflictInfo, DraftMutationCoordinator } from './draft-mutation-coordinator';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

function edit(overrides: Partial<ProductEditRow> = {}): ProductEditRow {
  return {
    id: 'edit-1',
    productId: 'p1',
    status: 'draft',
    version: 3,
    baseProductVersion: 3,
    name: 'Frozen peas',
    description: null,
    brand: null,
    category: null,
    defaultShelfLifeDays: null,
    notes: null,
    photos: [],
    moderationFeedback: null,
    submittedAt: null,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const LIVE: Pick<Product, 'name' | 'description' | 'brand' | 'category'> = {
  name: 'Frozen peas',
  description: null,
  brand: null,
  category: null,
};

/** Same hand-rolled-fake rationale as ProductPhotoEditor.test.tsx and the
 * two submit-panel test files — this file exercises ProductEditForm's own
 * save/conflict logic, not the coordinator itself. */
function makeCoordinator(initial: ProductEditRow) {
  let state = initial;
  const enqueue = jest.fn();
  const reconcileConflict = jest.fn();
  let conflictListener: ((info: ConflictInfo<ProductEditRow>) => void) | null = null;
  const coordinator: DraftMutationCoordinator<ProductEditRow> = {
    enqueue,
    flushMetadata: jest.fn().mockResolvedValue(state),
    reconcileConflict,
    getState: () => state,
    hasConflict: () => false,
    onConflict: jest.fn((listener) => {
      conflictListener = listener;
      return () => undefined;
    }),
  };
  return {
    coordinator,
    enqueue,
    reconcileConflict,
    setState: (next: ProductEditRow) => {
      state = next;
    },
    triggerConflict: (info: ConflictInfo<ProductEditRow>) => conflictListener?.(info),
  };
}

describe('<ProductEditForm />', () => {
  beforeEach(async () => {
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
  });

  it('prefills fields from the edit (the current proposed state, not the live product)', () => {
    const { coordinator } = makeCoordinator(edit({ name: 'Frozen peas (organic)' }));
    const { getByTestId } = render(wrap(<ProductEditForm initialEdit={edit({ name: 'Frozen peas (organic)' })} liveProduct={LIVE} coordinator={coordinator} />));
    expect(getByTestId('edit-name').props.value).toBe('Frozen peas (organic)');
  });

  it('enforces the name/description length limits and requires a non-empty name', async () => {
    const { coordinator } = makeCoordinator(edit());
    const { getByTestId, findByText } = render(wrap(<ProductEditForm initialEdit={edit()} liveProduct={LIVE} coordinator={coordinator} />));
    expect(getByTestId('edit-name').props.maxLength).toBe(200);
    expect(getByTestId('edit-description').props.maxLength).toBe(2000);

    fireEvent.changeText(getByTestId('edit-name'), '');
    fireEvent.press(getByTestId('edit-save'));
    expect(await findByText('Name is required')).toBeTruthy();
  });

  it('updates the live description counter as the user types', () => {
    const { coordinator } = makeCoordinator(edit());
    const { getByTestId } = render(wrap(<ProductEditForm initialEdit={edit()} liveProduct={LIVE} coordinator={coordinator} />));
    fireEvent.changeText(getByTestId('edit-description'), 'Great for stir fry');
    expect(getByTestId('edit-description-counter').props.children).toEqual([18, '/', 2000]);
  });

  it('shows a "Live: …" caption only for a field the proposal actually changes', () => {
    const { coordinator } = makeCoordinator(edit({ name: 'Frozen peas', brand: 'Acme' }));
    const { getByTestId, queryByText, getByText } = render(
      wrap(<ProductEditForm initialEdit={edit({ name: 'Frozen peas', brand: 'Acme' })} liveProduct={{ ...LIVE, brand: null }} coordinator={coordinator} />),
    );
    // Name matches the live value — no caption.
    expect(queryByText('Live: Frozen peas')).toBeNull();
    // Brand diverges from live (null) — caption shown.
    expect(getByText('Live: —')).toBeTruthy();

    fireEvent.changeText(getByTestId('edit-name'), 'Frozen peas (organic)');
    expect(getByText('Live: Frozen peas')).toBeTruthy();
  });

  it('saves via the coordinator and advances the known version', async () => {
    const { coordinator, enqueue } = makeCoordinator(edit());
    enqueue.mockResolvedValue(edit({ name: 'Frozen peas (organic)', version: 4 }));

    const { getByTestId } = render(wrap(<ProductEditForm initialEdit={edit()} liveProduct={LIVE} coordinator={coordinator} />));
    fireEvent.changeText(getByTestId('edit-name'), 'Frozen peas (organic)');
    fireEvent.press(getByTestId('edit-save'));

    await waitFor(() =>
      expect(enqueue).toHaveBeenCalledWith({
        kind: 'metadata',
        fields: {
          name: 'Frozen peas (organic)',
          description: null,
          brand: null,
          category: null,
          defaultShelfLifeDays: null,
          notes: null,
        },
      }),
    );
  });

  it('a coordinator conflict offers keep-and-retry / discard, both settling through reconcileConflict', async () => {
    const { coordinator, reconcileConflict, triggerConflict } = makeCoordinator(edit());
    const serverEntity = edit({ name: 'Someone else changed this', version: 5 });
    reconcileConflict.mockResolvedValue(edit({ name: 'My local edit', version: 6 }));

    const { getByTestId, findByTestId } = render(wrap(<ProductEditForm initialEdit={edit()} liveProduct={LIVE} coordinator={coordinator} />));
    fireEvent.changeText(getByTestId('edit-name'), 'My local edit');
    act(() => triggerConflict({ currentVersion: 5, serverEntity, pendingFields: { name: 'My local edit' } }));

    expect(await findByTestId('draft-conflict-banner')).toBeTruthy();
    expect(getByTestId('edit-name').props.value).toBe('My local edit');

    fireEvent.press(getByTestId('draft-conflict-retry'));
    await waitFor(() => expect(reconcileConflict).toHaveBeenCalledWith('retry'));
  });

  it('readOnly disables every field and hides Save', () => {
    const { getByTestId, queryByTestId } = render(wrap(<ProductEditForm initialEdit={edit()} liveProduct={LIVE} readOnly />));
    expect(getByTestId('edit-name').props.editable).toBe(false);
    expect(queryByTestId('edit-save')).toBeNull();
  });

  it('shows the moderation feedback banner only for a changes_required revision with feedback', () => {
    const { coordinator } = makeCoordinator(edit({ status: 'changes_required', moderationFeedback: 'Please clarify the name' }));
    const { getByText } = render(
      wrap(
        <ProductEditForm
          initialEdit={edit({ status: 'changes_required', moderationFeedback: 'Please clarify the name' })}
          liveProduct={LIVE}
          coordinator={coordinator}
        />,
      ),
    );
    expect(getByText('Please clarify the name')).toBeTruthy();
  });

  it('reports dirty state changes as the user edits', () => {
    const { coordinator } = makeCoordinator(edit());
    const onDirtyChange = jest.fn();
    const { getByTestId } = render(
      wrap(<ProductEditForm initialEdit={edit()} liveProduct={LIVE} coordinator={coordinator} onDirtyChange={onDirtyChange} />),
    );

    fireEvent.changeText(getByTestId('edit-name'), 'New name');
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });

  it('saves default shelf life and submitter notes', async () => {
    const { coordinator, enqueue } = makeCoordinator(edit());
    enqueue.mockResolvedValue(edit({ defaultShelfLifeDays: 45, notes: 'Packaging says 45 days', version: 4 }));

    const { getByTestId } = render(wrap(<ProductEditForm initialEdit={edit()} liveProduct={LIVE} coordinator={coordinator} />));
    fireEvent.changeText(getByTestId('edit-shelf-life'), '45');
    fireEvent.changeText(getByTestId('edit-notes'), 'Packaging says 45 days');
    fireEvent.press(getByTestId('edit-save'));

    await waitFor(() =>
      expect(enqueue).toHaveBeenCalledWith({
        kind: 'metadata',
        fields: {
          name: 'Frozen peas',
          description: null,
          brand: null,
          category: null,
          defaultShelfLifeDays: 45,
          notes: 'Packaging says 45 days',
        },
      }),
    );
  });

  it('validates default shelf life bounds and prevents submission of invalid numbers', async () => {
    const { coordinator, enqueue } = makeCoordinator(edit());

    const { getByTestId, findByText } = render(
      wrap(<ProductEditForm initialEdit={edit()} liveProduct={LIVE} coordinator={coordinator} />),
    );
    fireEvent.changeText(getByTestId('edit-shelf-life'), '4000');
    fireEvent.press(getByTestId('edit-save'));

    expect(await findByText('Default shelf life must be a whole number between 1 and 3650 days')).toBeTruthy();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
