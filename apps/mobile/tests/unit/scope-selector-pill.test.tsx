import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { ScopeSelectorPill } from '../../src/features/records/ScopeSelectorPill';
import { DefaultPantryModal } from '../../src/features/settings/DefaultPantryModal';
import * as householdsApi from '../../src/api/households';
import { usePantryScope } from '../../src/store/pantryScope';
import type { Household } from '@expyrico/shared';

jest.mock('../../src/api/households', () => ({
  useMyHouseholds: jest.fn(),
}));

const mockSingleHousehold: Household[] = [
  {
    id: 'hh-1',
    name: 'Main Kitchen',
    ownerUserId: 'u-1',
    myRole: 'owner',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

const mockMultiHouseholds: Household[] = [
  {
    id: 'hh-1',
    name: 'Main Kitchen',
    ownerUserId: 'u-1',
    myRole: 'owner',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'hh-2',
    name: 'Vacation Cabin',
    ownerUserId: 'u-1',
    myRole: 'member',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

describe('ScopeSelectorPill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cleanly hides (renders null) when user has 0 households', () => {
    (householdsApi.useMyHouseholds as jest.Mock).mockReturnValue({
      data: { items: [] },
    });

    const { queryByTestId } = renderWithTheme(
      <ScopeSelectorPill
        selectedScope="personal"
        selectedHouseholdId={null}
        onChange={jest.fn()}
      />,
      'expyrico',
    );

    expect(queryByTestId('scope-selector-pill')).toBeNull();
  });

  it('renders Personal and household name when user has 1 household', () => {
    (householdsApi.useMyHouseholds as jest.Mock).mockReturnValue({
      data: { items: mockSingleHousehold },
    });

    const { getByTestId, getByText } = renderWithTheme(
      <ScopeSelectorPill
        selectedScope="personal"
        selectedHouseholdId={null}
        onChange={jest.fn()}
      />,
      'expyrico',
    );

    expect(getByTestId('scope-selector-pill')).toBeTruthy();
    expect(getByText('Personal')).toBeTruthy();
    expect(getByText('Main Kitchen')).toBeTruthy();
  });

  it('calls onChange with personal when Personal segment is pressed', () => {
    (householdsApi.useMyHouseholds as jest.Mock).mockReturnValue({
      data: { items: mockSingleHousehold },
    });
    const handleChange = jest.fn();

    const { getByTestId } = renderWithTheme(
      <ScopeSelectorPill
        selectedScope="household"
        selectedHouseholdId="hh-1"
        onChange={handleChange}
      />,
      'expyrico',
    );

    const personalBtn = getByTestId('scope-selector-pill-personal');
    fireEvent.press(personalBtn);

    expect(handleChange).toHaveBeenCalledWith('personal', null);
  });

  it('calls onChange with household when Household segment is pressed with 1 household', () => {
    (householdsApi.useMyHouseholds as jest.Mock).mockReturnValue({
      data: { items: mockSingleHousehold },
    });
    const handleChange = jest.fn();

    const { getByTestId } = renderWithTheme(
      <ScopeSelectorPill
        selectedScope="personal"
        selectedHouseholdId={null}
        onChange={handleChange}
      />,
      'expyrico',
    );

    const hhBtn = getByTestId('scope-selector-pill-household');
    fireEvent.press(hhBtn);

    expect(handleChange).toHaveBeenCalledWith('household', 'hh-1');
  });

  it('opens household selection modal when multiple households are available and chooses one', () => {
    (householdsApi.useMyHouseholds as jest.Mock).mockReturnValue({
      data: { items: mockMultiHouseholds },
    });
    const handleChange = jest.fn();

    const { getByTestId } = renderWithTheme(
      <ScopeSelectorPill
        selectedScope="household"
        selectedHouseholdId="hh-1"
        onChange={handleChange}
      />,
      'expyrico',
    );

    const hhBtn = getByTestId('scope-selector-pill-household');
    fireEvent.press(hhBtn);

    // Modal opens, showing option for hh-2
    const optionHh2 = getByTestId('scope-selector-pill-option-hh-2');
    fireEvent.press(optionHh2);

    expect(handleChange).toHaveBeenCalledWith('household', 'hh-2');
  });
});

describe('DefaultPantryModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (householdsApi.useMyHouseholds as jest.Mock).mockReturnValue({
      data: { items: mockMultiHouseholds },
    });
  });

  it('renders Personal Pantry and all households as options', () => {
    const { getByTestId, getByText } = renderWithTheme(
      <DefaultPantryModal visible={true} onClose={jest.fn()} />,
      'expyrico',
    );

    expect(getByText('Default Pantry for New Items')).toBeTruthy();
    expect(getByTestId('default-pantry-option-personal')).toBeTruthy();
    expect(getByTestId('default-pantry-option-hh-1')).toBeTruthy();
    expect(getByTestId('default-pantry-option-hh-2')).toBeTruthy();
  });

  it('selects a household and closes modal', async () => {
    const handleClose = jest.fn();
    const setDefaultSpy = jest.fn();
    usePantryScope.setState({
      setDefaultPantryTarget: setDefaultSpy,
    });

    const { getByTestId } = renderWithTheme(
      <DefaultPantryModal visible={true} onClose={handleClose} />,
      'expyrico',
    );

    const hh1Option = getByTestId('default-pantry-option-hh-1');
    await act(async () => {
      fireEvent.press(hh1Option);
    });

    expect(setDefaultSpy).toHaveBeenCalledWith({
      scope: 'household',
      householdId: 'hh-1',
    });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
