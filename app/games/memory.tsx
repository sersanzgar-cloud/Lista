import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PrimaryButton from '../../src/components/PrimaryButton';
import ScreenHeader from '../../src/components/ScreenHeader';
import { games } from '../../src/data/games';
import { useApp } from '../../src/state/AppContext';
import { colors } from '../../src/theme/colors';

const SYMBOLS = ['🍎', '⚽', '🚗', '🌟', '🎈', '🐬'];
const MIN_MOVES = SYMBOLS.length;
const GAME = games.find((g) => g.id === 'memory')!;

interface Card {
  id: number;
  symbol: string;
  matched: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDeck(): Card[] {
  const pairs = shuffle([...SYMBOLS, ...SYMBOLS]);
  return pairs.map((symbol, id) => ({ id, symbol, matched: false }));
}

function calcCoins(moves: number): number {
  const penalty = Math.max(0, moves - MIN_MOVES) * 3;
  return Math.max(10, GAME.maxCoins - penalty);
}

export default function MemoryGame() {
  const router = useRouter();
  const { recordGameResult } = useApp();
  const [deck, setDeck] = useState<Card[]>(buildDeck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rewarded, setRewarded] = useState(false);

  const finished = deck.every((c) => c.matched);
  const coinsEarned = useMemo(() => calcCoins(moves), [moves]);

  function handleFlip(id: number) {
    if (busy || flipped.includes(id) || deck[id].matched) return;

    const nextFlipped = [...flipped, id];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      setBusy(true);
      setMoves((m) => m + 1);
      const [firstId, secondId] = nextFlipped;
      const isMatch = deck[firstId].symbol === deck[secondId].symbol;

      setTimeout(() => {
        if (isMatch) {
          setDeck((d) => d.map((c) => (c.id === firstId || c.id === secondId ? { ...c, matched: true } : c)));
        }
        setFlipped([]);
        setBusy(false);
      }, 700);
    }
  }

  function claimReward() {
    if (!rewarded) {
      recordGameResult(GAME.id, coinsEarned);
      setRewarded(true);
    }
    router.back();
  }

  function playAgain() {
    setDeck(buildDeck());
    setFlipped([]);
    setMoves(0);
    setBusy(false);
    setRewarded(false);
  }

  if (finished) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={GAME.title} />
        <View style={styles.resultBox}>
          <Text style={styles.resultEmoji}>🎉</Text>
          <Text style={styles.resultTitle}>¡Lo lograste!</Text>
          <Text style={styles.resultText}>Lo conseguiste en {moves} intentos</Text>
          <Text style={styles.resultCoins}>+{coinsEarned} 🪙</Text>
          <PrimaryButton label="Volver" onPress={claimReward} style={styles.resultButton} />
          <PrimaryButton label="Jugar otra vez" onPress={playAgain} variant="outline" style={styles.resultButton} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={GAME.title} />
      <Text style={styles.progress}>Intentos: {moves}</Text>

      <View style={styles.grid}>
        {deck.map((card) => {
          const isRevealed = card.matched || flipped.includes(card.id);
          return (
            <Pressable
              key={card.id}
              testID={`memory-card-${card.id}`}
              onPress={() => handleFlip(card.id)}
              style={[styles.card, isRevealed && styles.cardRevealed, card.matched && styles.cardMatched]}
            >
              <Text style={styles.cardText}>{isRevealed ? card.symbol : '❔'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  progress: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  card: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRevealed: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardMatched: {
    borderColor: colors.accent,
    backgroundColor: '#E9F7DA',
  },
  cardText: {
    fontSize: 32,
  },
  resultBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 30,
    width: '100%',
  },
  resultEmoji: {
    fontSize: 60,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  resultText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  resultCoins: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.coin,
    marginBottom: 12,
  },
  resultButton: {
    width: '100%',
    marginTop: 8,
  },
});
