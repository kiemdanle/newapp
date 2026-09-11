import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type * as ExpyricoThemeModule from '@expyrico/theme';
import { AddRecordForm } from '../features/records/AddRecordForm';
import { KeyboardAwareScrollView } from '../components/KeyboardAwareScrollView';
import { createLocalRecord } from '../api/records';

jest.mock('../api/records', () => ({
  createLocalRecord: jest.fn().mockResolvedValue('local-id-1'),
  useActiveRecords: () => [],
}));
const mockChoosePhotos = jest.fn();
jest.mock('../features/products/photo-picker-adapter', () => ({
  choosePhotos: (...args: unknown[]) => mockChoosePhotos(...args),
  handlePhotoPickerError: jest.fn(),
}));

interface MockProduct {
  id: string;
  name: string;
  category?: string | null;
}
const mockUseProduct = jest.fn((_id?: string): { data: MockProduct | null } => ({ data: null }));
jest.mock('../api/products', () => ({
  useCreateOrResumeDraft: () => ({ mutateAsync: jest.fn() }),
  usePatchDraft: () => ({ mutateAsync: jest.fn() }),
  useProduct: (id?: string) => mockUseProduct(id),
}));
interface HouseholdsResult {
  data: { items: Array<{ id: string; name: string }> };
}
const mockMyHouseholds = jest.fn<HouseholdsResult, []>(() => ({ data: { items: [] } }));
jest.mock('../api/households', () => ({
  useMyHouseholds: () => mockMyHouseholds(),
}));

interface PantryScopeResult {
  scope: 'personal' | 'household';
  householdId: string | null;
  setScope: (...args: unknown[]) => void;
}
const mockPantryScope = jest.fn<PantryScopeResult, []>(() => ({ scope: 'personal', householdId: null, setScope: jest.fn() }));
jest.mock('../store/pantryScope', () => ({
  usePantryScope: () => mockPantryScope(),
}));

jest.mock('../theme/useTheme', () => ({
  useTheme: () => jest.requireActual<typeof ExpyricoThemeModule>('@expyrico/theme').themes.expyrico,
}));
jest.mock('../utils/units', () => ({
  ...jest.requireActual('../utils/units'),
  usePantryTopUnits: () => ['pcs', 'pack', 'can', 'bottle'],
}));

describe('AddRecordForm', () => {
  afterEach(() => {
    cleanup();
  });
  it('shows a validation error when expiry is empty', async () => {
    const { getByTestId, findByText } = render(
      <AddRecordForm productName="Milk" productId="p-1" onSaved={jest.fn()} />,
    );
    fireEvent.press(getByTestId('add-record-save'));
    expect(await findByText(/required/i)).toBeTruthy();
  });

  it('calls createLocalRecord with productId + expiry and invokes onSaved', async () => {
    const onSaved = jest.fn();
    const { getByTestId } = render(
      <AddRecordForm productName="Milk" productId="p-1" onSaved={onSaved} />,
    );
    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2099-12-31');
    fireEvent.changeText(getByTestId('add-record-quantity'), '3');
    fireEvent.press(getByTestId('add-record-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('local-id-1'));
    expect(createLocalRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'p-1',
        expiryDate: '2099-12-31',
        quantity: 3,
        unit: 'pcs',
      }),
    );
  });

  it('lockedPersonalScope hides the household picker and persists householdId: null even from an active household scope', async () => {
    mockPantryScope.mockReturnValue({ scope: 'household', householdId: 'hh-1', setScope: jest.fn() });
    mockMyHouseholds.mockReturnValue({ data: { items: [{ id: 'hh-1', name: 'Our kitchen' }] } });

    const onSaved = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <AddRecordForm productName="Milk" productId="p-1" onSaved={onSaved} lockedPersonalScope />,
    );

    // No household picker at all — not even the "Personal" chip — while locked.
    expect(queryByTestId('add-record-pantry-personal')).toBeNull();
    expect(queryByTestId('add-record-pantry-hh-1')).toBeNull();
    expect(queryByTestId('add-record-scope-selector')).toBeNull();
    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2099-12-31');
    fireEvent.press(getByTestId('add-record-save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('local-id-1'));
    expect(createLocalRecord).toHaveBeenCalledWith(expect.objectContaining({ householdId: null }));
  });

  it('applies focus styles and exercises input focus across fields including expanded price/store', () => {
    const { getByTestId } = render(
      <KeyboardAwareScrollView>
        <AddRecordForm
          productName="Apples"
          productId="p-1"
          onSaved={jest.fn()}
        />
      </KeyboardAwareScrollView>,
    );

    // 1. Quantity focus & blur
    const qtyInput = getByTestId('add-record-quantity');
    fireEvent(qtyInput, 'focus');
    expect(StyleSheet.flatten(qtyInput.props.style)).toMatchObject({
      borderColor: '#4BAE8A',
      borderWidth: 1.5,
    });
    fireEvent(qtyInput, 'blur');
    expect(StyleSheet.flatten(qtyInput.props.style)).toMatchObject({
      borderWidth: 1,
    });

    // 2. Category focus
    const catInput = getByTestId('add-record-category');
    fireEvent(catInput, 'focus');
    expect(StyleSheet.flatten(catInput.props.style)).toMatchObject({
      borderColor: '#4BAE8A',
      borderWidth: 1.5,
    });
    fireEvent(catInput, 'blur');

    // 3. Notes focus
    const notesInput = getByTestId('add-record-notes');
    fireEvent(notesInput, 'focus');
    expect(StyleSheet.flatten(notesInput.props.style)).toMatchObject({
      borderColor: '#4BAE8A',
      borderWidth: 1.5,
    });
    fireEvent(notesInput, 'blur');

    // 4. Expand + More details (Price & Store)
    const moreToggle = getByTestId('add-record-more-toggle');
    fireEvent.press(moreToggle);

    // 5. Price focus
    const priceInput = getByTestId('add-record-price');
    fireEvent(priceInput, 'focus');
    expect(StyleSheet.flatten(priceInput.props.style)).toMatchObject({
      borderColor: '#4BAE8A',
      borderWidth: 1.5,
    });
    fireEvent(priceInput, 'blur');

    // 6. Store focus
    const storeInput = getByTestId('add-record-store');
    fireEvent(storeInput, 'focus');
    expect(StyleSheet.flatten(storeInput.props.style)).toMatchObject({
      borderColor: '#4BAE8A',
      borderWidth: 1.5,
    });
    fireEvent(storeInput, 'blur');
  });

  it('pre-fills category when initialCategory prop is provided', () => {
    const { getByTestId } = render(
      <AddRecordForm
        productName="Milk"
        productId="p-1"
        initialCategory="Dairy & Eggs"
        onSaved={jest.fn()}
      />,
    );
    const categoryInput = getByTestId('add-record-category');
    expect(categoryInput.props.value).toBe('Dairy & Eggs');
  });

  it('pre-fills category from product data when product has a category', () => {
    mockUseProduct.mockReturnValue({
      data: { id: 'p-1', name: 'Almond Milk', category: 'Plant-Based' },
    });

    const { getByTestId } = render(
      <AddRecordForm
        productName="Almond Milk"
        productId="p-1"
        onSaved={jest.fn()}
      />,
    );
    const categoryInput = getByTestId('add-record-category');
    expect(categoryInput.props.value).toBe('Plant-Based');
  });

  it('persists pre-filled category when saving the record', async () => {
    const onSaved = jest.fn();
    const { getByTestId } = render(
      <AddRecordForm
        productName="Sourdough"
        productId="p-1"
        initialCategory="Bakery"
        onSaved={onSaved}
      />,
    );
    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2026-10-15');
    fireEvent.press(getByTestId('add-record-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('local-id-1'));
    expect(createLocalRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'p-1',
        category: 'Bakery',
      }),
    );
  });

  it('allows user to override pre-filled category and saves the updated value', async () => {
    const onSaved = jest.fn();
    const { getByTestId } = render(
      <AddRecordForm
        productName="Orange Juice"
        productId="p-1"
        initialCategory="Beverages"
        onSaved={onSaved}
      />,
    );
    const categoryInput = getByTestId('add-record-category');
    expect(categoryInput.props.value).toBe('Beverages');

    fireEvent.changeText(categoryInput, 'Fresh Drinks');
    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2026-10-15');
    fireEvent.press(getByTestId('add-record-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('local-id-1'));
    expect(createLocalRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'p-1',
        category: 'Fresh Drinks',
      }),
    );
  });

  it('renders editable item name input when productId is null and validates required name', async () => {
    const { getByTestId, findByText } = render(
      <AddRecordForm productId={null} onSaved={jest.fn()} />,
    );
    expect(getByTestId('add-record-custom-name')).toBeTruthy();

    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2026-10-15');
    fireEvent.press(getByTestId('add-record-save'));
    expect(await findByText('Item name is required')).toBeTruthy();
  });

  it('saves custom item without barcode with name and category chip selection', async () => {
    const onSaved = jest.fn();
    const { getByTestId } = render(
      <AddRecordForm productId={null} onSaved={onSaved} />,
    );

    fireEvent.changeText(getByTestId('add-record-custom-name'), 'Honeycrisp Apples');
    fireEvent.press(getByTestId('add-record-category-chip-produce'));
    expect(getByTestId('add-record-category').props.value).toBe('Produce');

    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2026-09-20');
    fireEvent.changeText(getByTestId('add-record-quantity'), '4');
    fireEvent.press(getByTestId('add-record-save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('local-id-1'));
    expect(createLocalRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: null,
        customName: 'Honeycrisp Apples',
        category: 'Produce',
        expiryDate: '2026-09-20',
        quantity: 4,
        unit: 'pcs',
      }),
    );
  });

  it('saves new item with selected location pill', async () => {
    const onSaved = jest.fn();
    const { getByTestId } = render(
      <AddRecordForm productId="prod-1" productName="Cereal" onSaved={onSaved} />,
    );

    expect(getByTestId('add-record-location-selector')).toBeTruthy();
    fireEvent.press(getByTestId('location-pill-fridge'));

    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2026-11-01');
    fireEvent.press(getByTestId('add-record-save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('local-id-1'));
    expect(createLocalRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-1',
        location: 'Fridge',
        expiryDate: '2026-11-01',
      }),
    );
  });
  it('automatically sets expiry date when scannedExpiry prop is supplied', async () => {
    const { getByTestId } = render(
      <AddRecordForm
        productId="prod-1"
        productName="Milk"
        onSaved={jest.fn()}
        scannedExpiry="2026-12-25"
      />,
    );

    expect(getByTestId('add-record-expiry-input').props.value).toBe('2026-12-25');
  });

  it('supports selecting multiple photos, previewing them with count, and removing individual photos', async () => {
    const onSaved = jest.fn();
    mockChoosePhotos.mockResolvedValueOnce([
      { path: '/local/photo1.jpg', width: 800, height: 600, mime: 'image/jpeg', size: 1024 },
      { path: '/local/photo2.jpg', width: 800, height: 600, mime: 'image/jpeg', size: 1024 },
    ]);

    const { getByTestId, getByText, findByTestId } = render(
      <AddRecordForm productId="prod-1" productName="Apples" onSaved={onSaved} />,
    );

    // Tap Choose Photo
    fireEvent.press(getByTestId('add-record-choose-photo'));
    await waitFor(() => expect(mockChoosePhotos).toHaveBeenCalledWith(5));

    // Both photos are rendered
    expect(await findByTestId('add-record-photo-preview')).toBeTruthy();
    expect(getByTestId('add-record-photo-preview-1')).toBeTruthy();
    expect(getByText('2/5 photos')).toBeTruthy();

    // Remove first photo
    fireEvent.press(getByTestId('add-record-photo-remove'));
    expect(getByText('1/5 photos')).toBeTruthy();

    // Add second batch
    mockChoosePhotos.mockResolvedValueOnce([
      { path: '/local/photo3.jpg', width: 800, height: 600, mime: 'image/jpeg', size: 1024 },
    ]);
    fireEvent.press(getByTestId('add-record-add-more-photos'));
    await waitFor(() => expect(mockChoosePhotos).toHaveBeenCalledWith(4));
    expect(getByText('2/5 photos')).toBeTruthy();

    // Save and verify stored JSON array
    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2026-10-31');
    fireEvent.press(getByTestId('add-record-save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('local-id-1'));
    expect(createLocalRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-1',
        localPhotos: ['/local/photo2.jpg', '/local/photo3.jpg'],
      }),
    );
  });
});
