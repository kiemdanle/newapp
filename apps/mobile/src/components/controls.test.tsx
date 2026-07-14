import React from 'react';
import { Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';
import { themes } from '@expyrico/theme';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { OtpInput } from './OtpInput';
import { TextField } from './TextField';

const theme = themes.expyrico;

jest.mock('../theme/useTheme', () => ({
  useTheme: () => jest.requireActual<typeof import('@expyrico/theme')>('@expyrico/theme').themes.expyrico,
}));

function pressableStyle(
  node: { props: { style: (state: { pressed: boolean }) => unknown } },
  pressed = false,
): ViewStyle {
  return StyleSheet.flatten(node.props.style({ pressed }) as ViewStyle) as ViewStyle;
}

describe('shared Expyrico controls', () => {
  it.each([
    ['primary', theme.colors.accent],
    ['secondary', theme.colors.primary],
    ['danger', theme.colors.danger],
  ] as const)('renders the %s button with its semantic fill and a 52dp target', (variant, color) => {
    const screen = render(<Button testID="control" label="Continue" onPress={jest.fn()} variant={variant} />);
    const style = pressableStyle(screen.UNSAFE_getByType(Pressable));

    expect(style.backgroundColor).toBe(color);
    expect(style.height).toBe(52);
    expect(style.minHeight).toBe(52);
  });

  it('renders outline and ghost buttons as sage tertiary actions without a visible border', () => {
    const screen = render(
      <>
        <Button testID="outline" label="Resend code" onPress={jest.fn()} variant="outline" />
        <Button testID="ghost" label="Change email" onPress={jest.fn()} variant="ghost" />
      </>,
    );

    const [outline, ghost] = screen.UNSAFE_getAllByType(Pressable);
    expect(pressableStyle(outline).borderColor).toBe(theme.colors.primary);
    expect(pressableStyle(ghost).borderColor).toBe('transparent');
    expect(screen.getByText('Change email').props.style[1].color).toBe(theme.colors.primary);
  });

  it('keeps form fields at a 48dp target and gives errors the danger token', () => {
    const screen = render(<TextField label="Email" error="Enter an email" value="" onChangeText={jest.fn()} />);
    const input = screen.getByLabelText('Email');
    const style = StyleSheet.flatten(input.props.style);

    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style.borderColor).toBe(theme.colors.danger);
    expect(screen.getByText('Enter an email').props.style[1].color).toBe(theme.colors.danger);
  });

  it('keeps native OTP autofill while using the Expyrico filled and active states', () => {
    const screen = render(<OtpInput label="Verification code" value="1" onChangeText={jest.fn()} />);
    const input = screen.getByLabelText('Verification code') as ReactTestInstanceLike;
    const cells = screen.UNSAFE_getAllByType(View).filter((node) => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.height === 62;
    });

    expect((input as unknown as TextInput).props.textContentType).toBe('oneTimeCode');
    expect((input as unknown as TextInput).props.autoComplete).toBe('one-time-code');
    const firstCell = StyleSheet.flatten(cells[0].props.style as ViewStyle) as ViewStyle;
    const activeCell = StyleSheet.flatten(cells[1].props.style as ViewStyle) as ViewStyle;
    expect(firstCell.backgroundColor).toBe(theme.colors.primaryLight);
    expect(activeCell.backgroundColor).toBe(theme.colors.accentLight);
    expect(activeCell.borderColor).toBe(theme.colors.accent);
  });

  it('makes an empty-state action use the shared primary button', () => {
    const screen = render(
      <EmptyState icon="leaf-outline" title="Nothing here" body="Add an item to begin." actionLabel="Add item" onAction={jest.fn()} />,
    );
    const action = screen.UNSAFE_getByType(Pressable);

    expect(pressableStyle(action).backgroundColor).toBe(theme.colors.accent);
    expect(pressableStyle(action).minHeight).toBe(52);
  });
});

type ReactTestInstanceLike = { props: Record<string, unknown> };
