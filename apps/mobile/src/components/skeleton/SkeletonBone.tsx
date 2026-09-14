import React from 'react';
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface SkeletonBoneProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SkeletonBone({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
  testID,
}: SkeletonBoneProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.bone,
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.neutralLight,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  bone: {
    overflow: 'hidden',
  },
});
