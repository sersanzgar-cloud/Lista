import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import CoinBadge from './CoinBadge';

interface ScreenHeaderProps {
  title: string;
  showCoins?: boolean;
  onBack?: () => void;
}

export default function ScreenHeader({ title, showCoins, onBack }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        style={styles.backButton}
        hitSlop={12}
        accessibilityLabel="Volver"
      >
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      {showCoins ? <CoinBadge /> : <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: {
    fontSize: 26,
    color: colors.text,
    marginTop: -2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  spacer: {
    width: 40,
  },
});
