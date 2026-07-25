import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useApp } from '../state/AppContext';
import { colors } from '../theme/colors';

export default function CoinBadge() {
  const { coins } = useApp();

  return (
    <View style={styles.badge}>
      <Text style={styles.coinIcon}>🪙</Text>
      <Text style={styles.coinText}>{coins}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  coinIcon: {
    fontSize: 16,
  },
  coinText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
});
