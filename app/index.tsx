import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Avatar from '../src/components/Avatar';
import CoinBadge from '../src/components/CoinBadge';
import PrimaryButton from '../src/components/PrimaryButton';
import { useApp } from '../src/state/AppContext';
import { colors } from '../src/theme/colors';

function moodLabel(mood: number): string {
  if (mood >= 55) return '¡Feliz!';
  if (mood >= 25) return 'Normal';
  return 'Tiene hambre';
}

export default function Home() {
  const router = useRouter();
  const { loaded, avatar, mood, coins } = useApp();

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!avatar) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.push('/settings')} style={styles.iconButton} accessibilityLabel="Ajustes">
          <Text style={styles.iconText}>⚙️</Text>
        </Pressable>
        <CoinBadge />
      </View>

      <View style={styles.avatarWrap}>
        <Avatar avatar={avatar} size={220} mood={mood} />
      </View>

      <Text style={styles.name}>{avatar.name}</Text>

      <View style={styles.moodRow}>
        <Text style={styles.moodLabel}>{moodLabel(mood)}</Text>
        <View style={styles.moodBarTrack}>
          <View style={[styles.moodBarFill, { width: `${mood}%` }]} />
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="🎮 Jugar" onPress={() => router.push('/games')} variant="primary" style={styles.actionButton} />
        <PrimaryButton label="🛍️ Tienda" onPress={() => router.push('/shop')} variant="secondary" style={styles.actionButton} />
      </View>

      <Text style={styles.coinsHint}>Tienes {coins} monedas para vestir y alimentar a {avatar.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconText: {
    fontSize: 18,
  },
  avatarWrap: {
    marginTop: 12,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  moodRow: {
    width: '100%',
    marginTop: 16,
    alignItems: 'center',
  },
  moodLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
  },
  moodBarTrack: {
    width: '80%',
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  moodBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 7,
  },
  actions: {
    width: '100%',
    marginTop: 28,
    gap: 14,
  },
  actionButton: {
    width: '100%',
  },
  coinsHint: {
    marginTop: 20,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
