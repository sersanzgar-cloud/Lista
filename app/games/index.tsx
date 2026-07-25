import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ScreenHeader from '../../src/components/ScreenHeader';
import { gamesForBracket } from '../../src/data/games';
import { useApp } from '../../src/state/AppContext';
import { colors } from '../../src/theme/colors';

export default function GamesHub() {
  const router = useRouter();
  const { ageBracket, highScores } = useApp();
  const games = ageBracket ? gamesForBracket(ageBracket) : [];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Minijuegos" showCoins />

      <View style={styles.list}>
        {games.map((game) => (
          <Pressable key={game.id} style={styles.card} onPress={() => router.push(game.route as never)}>
            <Text style={styles.emoji}>{game.emoji}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{game.title}</Text>
              <Text style={styles.cardDesc}>{game.description}</Text>
              {highScores[game.id] ? (
                <Text style={styles.cardBest}>Mejor: {highScores[game.id]} 🪙</Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: 20,
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  emoji: {
    fontSize: 42,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  cardDesc: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardBest: {
    fontSize: 13,
    color: colors.primaryDark,
    marginTop: 4,
    fontWeight: '700',
  },
});
