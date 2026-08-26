import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Avatar } from './Avatar';

describe('Avatar component', () => {
  it('renders initials when no image URL is provided', () => {
    const { getByText, getByTestId } = render(
      <Avatar firstName="John" lastName="Doe" size="md" />,
    );

    expect(getByText('JD')).toBeTruthy();
    expect(getByTestId('user-avatar')).toBeTruthy();
  });

  it('renders image when URL is provided', () => {
    const { getByTestId, queryByText } = render(
      <Avatar url="https://example.com/avatar.webp" firstName="Jane" lastName="Smith" />,
    );

    expect(getByTestId('user-avatar-image')).toBeTruthy();
    expect(queryByText('JS')).toBeNull();
  });

  it('renders editable badge and fires onEditPress callback', () => {
    const onEdit = jest.fn();
    const { getByTestId } = render(
      <Avatar firstName="Alex" lastName="Wong" editable onEditPress={onEdit} />,
    );

    const editBadge = getByTestId('user-avatar-edit-badge');
    expect(editBadge).toBeTruthy();
    fireEvent.press(editBadge);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
