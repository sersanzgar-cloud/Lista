import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PrimaryButton from '../../src/components/PrimaryButton';
import ScreenHeader from '../../src/components/ScreenHeader';
import { games } from '../../src/data/games';
import { useApp } from '../../src/state/AppContext';
import { colors } from '../../src/theme/colors';

const ANIMALS = ['🐶', '🐱', '🐰', '🐸', '🐮', '🐵', '🐷', '🦁', '🐔', '🐻'];
const TOTAL_ROUNDS = 8;
const COINS_PER_CORRECT = 5;
const GAME = games.find((g) => g.id === 'animal-match')!;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRound() {
  const shuffled = shuffle(ANIMALS);
  const target = shuffled[0];
  const options = shuffle(shuffled.slice(0, 4));
  return { target, options };
}

export default function AnimalMatchGame() {
  const router = useRouter();
  const { recordGameResult } = useApp();
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [current, setCurrent] = useState(buildRound);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [finished, setFinished] = useState(false);
  const [rewarded, setRewarded] = useState(false);

  const coinsEarned = useMemo(() => score * COINS_PER_CORRECT, [score]);

  function handleAnswer(option: string) {
    if (feedback) return;
    const isCorrect = option === current.target;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setScore((s) => s + 1);

    setTimeout(() => {
      if (round + 1 >= TOTAL_ROUNDS) {
        setFinished(true);
      } else {
        setRound((r) => r + 1);
        setCurrent(buildRound());
      }
      setFeedback(null);
    }, 600);
  }

  function claimReward() {
    if (!rewarded) {
      recordGameResult(GAME.id, coinsEarned);
      setRewarded(true);
    }
    router.back();
  }

  function playAgain() {
    setRound(0);
    setScore(0);
    setCurrent(buildRound());
    setFeedback(null);
    setFinished(false);
    setRewarded(false);
  }

  if (finished) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={GAME.title} />
        <View style={styles.resultBox}>
          <Text style={styles.resultEmoji}>🎉</Text>
          <Text style={styles.resultTitle}>¡Muy bien!</Text>
          <Text style={styles.resultText}>Acertaste {score} de {TOTAL_ROUNDS}</Text>
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
      <Text style={styles.progress}>Ronda {round + 1} / {TOTAL_ROUNDS}</Text>

      <View style={styles.targetBox} testID="animal-target">
        <Text style={styles.targetEmoji}>{current.target}</Text>
      </View>
      <Text style={styles.instruction}>Toca el mismo animal</Text>

      <View style={styles.optionsGrid}>
        {current.options.map((option, idx) => {
          const isThisCorrect = feedback && option === current.target;
          return (
            <Pressable
              key={`${option}-${idx}`}
              testID={`animal-option-${idx}`}
              onPress={() => handleAnswer(option)}
              style={[
                styles.optionCard,
                isThisCorrect && styles.optionCorrect,
              ]}
            >
              <Text style={styles.optionEmoji}>{option}</Text>
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
  },
  targetBox: {
    width: 140,
    height: 140,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  targetEmoji: {
    fontSize: 80,
  },
  instruction: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 20,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  optionCard: {
    width: 100,
    height: 100,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCorrect: {
    borderColor: colors.accent,
    backgroundColor: '#E9F7DA',
  },
  optionEmoji: {
    fontSize: 52,
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
