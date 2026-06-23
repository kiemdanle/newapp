import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

type LogoProps = {
  size?: number;
  withWordmark?: boolean;
  suffix?: string;
};

export function Logo({ size = 32, withWordmark = false, suffix }: LogoProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Image
        source={require('../../assets/logo-mark.png')}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        resizeMode="contain"
        accessibilityLabel="Expyrico"
      />
      {withWordmark && (
        <View style={styles.words}>
          <Text
            style={{
              fontSize: size * 0.56,
              fontWeight: '600',
              color: theme.colors.text,
              letterSpacing: -0.8,
            }}
          >
            expyrico
          </Text>
          {suffix ? (
            <Text
              style={{
                fontSize: size * 0.44,
                fontWeight: '500',
                color: theme.colors.textMuted,
              }}
            >
              {' '}
              {suffix}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  words: { flexDirection: 'row', alignItems: 'baseline' },
});
