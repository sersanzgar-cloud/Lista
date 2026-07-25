import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PrimaryButton from '../../src/components/PrimaryButton';
import ScreenHeader from '../../src/components/ScreenHeader';
import { games } from '../../src/data/games';
import { useApp } from '../../src/state/AppContext';
import { colors } from '../../src/theme/colors';

const GAME_SECONDS = 45;
const COINS_PER_CORRECT = 5;
const STREAK_BONUS_EVERY = 5;
const STREAK_BONUS_AMOUNT = 5;
const GAME = games.find((g) => g.id === 'quick-math')!;

type Op = '+' | '-' | '×';

interface Question {
  a: number;
  b: number;
  op: Op;
  answer: number;
  options: number[];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuestion(): Question {
  const ops: Op[] = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;

  if (op === '+') {
    a = 1 + Math.floor(Math.random() * 50);
    b = 1 + Math.floor(Math.random() * 50);
    answer = a + b;
  } else if (op === '-') {
    a = 1 + Math.floor(Math.random() * 50);
    b = 1 + Math.floor(Math.random() * a);
    answer = a - b;
  } else {
    a = 1 + Math.floor(Math.random() * 12);
    b = 1 + Math.floor(Math.random() * 12);
    answer = a * b;
  }

  const distractors = new Set<number>();
  while (distractors.size < 3) {
    const delta = 1 + Math.floor(Math.random() * 8);
    const candidate = Math.random() < 0.5 ? answer + delta : answer - delta;
    if (candidate !== answer && candidate >= 0) distractors.add(candidate);
  }

  const options = shuffle([answer, ...distractors]);
  return { a, b, op, answer, options };
}

export default function QuickMathGame() {
  const router = useRouter();
  const { recordGameResult } = useApp();
  const [question, setQuestion] = useState<Question>(buildQuestion);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [finished, setFinished] = useState(false);
  const [rewarded, setRewarded] = useState(false);
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null);
  const coinsRef = useRef(0);

  useEffect(() => {
    if (finished) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setFinished(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [finished]);

  const handleAnswer = useCallback(
    (value: number) => {
      if (finished) return;
      const isCorrect = value === question.answer;
      setFlash(isCorrect ? 'correct' : 'wrong');
      setTimeout(() => setFlash(null), 250);

      if (isCorrect) {
        setScore((s) => s + 1);
        setStreak((prev) => {
          const next = prev + 1;
          coinsRef.current += COINS_PER_CORRECT + (next % STREAK_BONUS_EVERY === 0 ? STREAK_BONUS_AMOUNT : 0);
          return next;
        });
      } else {
        setStreak(0);
      }
      setQuestion(buildQuestion());
    },
    [finished, question.answer],
  );

  const coinsEarned = useMemo(() => Math.min(GAME.maxCoins, coinsRef.current), [finished]);

  function claimReward() {
    if (!rewarded) {
      recordGameResult(GAME.id, coinsEarned);
      setRewarded(true);
    }
    router.back();
  }

  function playAgain() {
    setQuestion(buildQuestion());
    setScore(0);
    setStreak(0);
    setTimeLeft(GAME_SECONDS);
    setFinished(false);
    setRewarded(false);
    coinsRef.current = 0;
  }

  if (finished) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={GAME.title} />
        <View style={styles.resultBox}>
          <Text style={styles.resultEmoji}>🏆</Text>
          <Text style={styles.resultTitle}>¡Tiempo!</Text>
          <Text style={styles.resultText}>{score} respuestas correctas</Text>
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

      <View style={styles.statsRow}>
        <Text style={styles.stat}>⏱ {timeLeft}s</Text>
        <Text style={styles.stat}>✅ {score}</Text>
        <Text style={styles.stat}>🔥 {streak}</Text>
      </View>

      <View
        style={[styles.questionBox, flash === 'correct' && styles.flashCorrect, flash === 'wrong' && styles.flashWrong]}
        testID="math-question"
      >
        <Text style={styles.questionText}>
          {question.a} {question.op} {question.b} = ?
        </Text>
      </View>

      <View style={styles.optionsGrid}>
        {question.options.map((option, idx) => (
          <Pressable
            key={option}
            testID={`math-option-${idx}`}
            onPress={() => handleAnswer(option)}
            style={styles.optionCard}
          >
            <Text style={styles.optionText}>{option}</Text>
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
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  stat: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  questionBox: {
    width: '85%',
    paddingVertical: 28,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  flashCorrect: {
    borderColor: colors.accent,
    backgroundColor: '#E9F7DA',
  },
  flashWrong: {
    borderColor: colors.danger,
    backgroundColor: '#FBE3E4',
  },
  questionText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  optionCard: {
    width: 90,
    height: 70,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
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
