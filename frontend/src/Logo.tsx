import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS } from './theme';

// Placeholder logo — gold initials on black. Replace later with real logo image.
export default function Logo({ size = 84 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]} testID="brand-logo">
      <View style={[styles.inner, { borderRadius: size / 2 - 6 }]}>
        <Text style={[styles.text, { fontSize: size * 0.32 }]}>KA</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1.5,
    borderColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    backgroundColor: COLORS.surface,
  },
  inner: {
    flex: 1,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: COLORS.brandSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: COLORS.brand,
    fontFamily: FONTS.displayBold,
    letterSpacing: 2,
  },
});
