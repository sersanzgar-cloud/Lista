import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { HairStyleId, OutfitId, FREE_HAIR_STYLES, FREE_OUTFITS } from '../data/catalog';
import { AgeBracket } from '../data/games';
import { skinTones, hairColors, eyeColors } from '../theme/colors';

const STORAGE_KEY = 'compi:v1';
const MOOD_DECAY_PER_MINUTE = 100 / (12 * 60); // fully drains in ~12 hours

export interface AvatarConfig {
  name: string;
  skinTone: string;
  hairStyle: HairStyleId;
  hairColor: string;
  eyeColor: string;
  outfitId: OutfitId;
}

interface AppData {
  avatar: AvatarConfig | null;
  ageBracket: AgeBracket | null;
  coins: number;
  ownedHairStyles: HairStyleId[];
  ownedOutfits: OutfitId[];
  mood: number;
  moodTimestamp: number;
  highScores: Record<string, number>;
}

const defaultAvatar: AvatarConfig = {
  name: '',
  skinTone: skinTones[0],
  hairStyle: 'short',
  hairColor: hairColors[0],
  eyeColor: eyeColors[0],
  outfitId: 'basic-tee',
};

const initialData: AppData = {
  avatar: null,
  ageBracket: null,
  coins: 0,
  ownedHairStyles: [...FREE_HAIR_STYLES],
  ownedOutfits: [...FREE_OUTFITS],
  mood: 80,
  moodTimestamp: Date.now(),
  highScores: {},
};

function computeCurrentMood(mood: number, moodTimestamp: number): number {
  const minutesPassed = (Date.now() - moodTimestamp) / 60000;
  const decayed = mood - minutesPassed * MOOD_DECAY_PER_MINUTE;
  return Math.max(0, Math.min(100, Math.round(decayed)));
}

interface AppContextValue {
  loaded: boolean;
  avatar: AvatarConfig | null;
  ageBracket: AgeBracket | null;
  coins: number;
  mood: number;
  ownedHairStyles: HairStyleId[];
  ownedOutfits: OutfitId[];
  highScores: Record<string, number>;
  defaultAvatar: AvatarConfig;
  completeOnboarding: (avatar: AvatarConfig, ageBracket: AgeBracket) => void;
  updateAvatar: (partial: Partial<AvatarConfig>) => void;
  setAgeBracket: (bracket: AgeBracket) => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  buyHairStyle: (styleId: HairStyleId, price: number) => boolean;
  buyOutfit: (outfitId: OutfitId, price: number) => boolean;
  feed: (moodGain: number, price: number) => boolean;
  recordGameResult: (gameId: string, coinsEarned: number) => void;
  resetProgress: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(initialData);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          setData({ ...initialData, ...JSON.parse(raw) });
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, loaded]);

  const completeOnboarding = useCallback((avatar: AvatarConfig, ageBracket: AgeBracket) => {
    setData((prev) => ({ ...prev, avatar, ageBracket }));
  }, []);

  const updateAvatar = useCallback((partial: Partial<AvatarConfig>) => {
    setData((prev) => (prev.avatar ? { ...prev, avatar: { ...prev.avatar, ...partial } } : prev));
  }, []);

  const setAgeBracket = useCallback((bracket: AgeBracket) => {
    setData((prev) => ({ ...prev, ageBracket: bracket }));
  }, []);

  const addCoins = useCallback((amount: number) => {
    setData((prev) => ({ ...prev, coins: prev.coins + amount }));
  }, []);

  const spendCoins = useCallback((amount: number): boolean => {
    let success = false;
    setData((prev) => {
      if (prev.coins < amount) return prev;
      success = true;
      return { ...prev, coins: prev.coins - amount };
    });
    return success;
  }, []);

  const buyHairStyle = useCallback((styleId: HairStyleId, price: number): boolean => {
    let success = false;
    setData((prev) => {
      if (prev.coins < price || prev.ownedHairStyles.includes(styleId)) return prev;
      success = true;
      return { ...prev, coins: prev.coins - price, ownedHairStyles: [...prev.ownedHairStyles, styleId] };
    });
    return success;
  }, []);

  const buyOutfit = useCallback((outfitId: OutfitId, price: number): boolean => {
    let success = false;
    setData((prev) => {
      if (prev.coins < price || prev.ownedOutfits.includes(outfitId)) return prev;
      success = true;
      return { ...prev, coins: prev.coins - price, ownedOutfits: [...prev.ownedOutfits, outfitId] };
    });
    return success;
  }, []);

  const feed = useCallback((moodGain: number, price: number): boolean => {
    let success = false;
    setData((prev) => {
      if (prev.coins < price) return prev;
      success = true;
      const currentMood = computeCurrentMood(prev.mood, prev.moodTimestamp);
      return {
        ...prev,
        coins: prev.coins - price,
        mood: Math.min(100, currentMood + moodGain),
        moodTimestamp: Date.now(),
      };
    });
    return success;
  }, []);

  const recordGameResult = useCallback((gameId: string, coinsEarned: number) => {
    setData((prev) => ({
      ...prev,
      coins: prev.coins + coinsEarned,
      highScores: {
        ...prev.highScores,
        [gameId]: Math.max(prev.highScores[gameId] ?? 0, coinsEarned),
      },
    }));
  }, []);

  const resetProgress = useCallback(() => {
    setData(initialData);
  }, []);

  const mood = useMemo(() => computeCurrentMood(data.mood, data.moodTimestamp), [data.mood, data.moodTimestamp]);

  const value: AppContextValue = {
    loaded,
    avatar: data.avatar,
    ageBracket: data.ageBracket,
    coins: data.coins,
    mood,
    ownedHairStyles: data.ownedHairStyles,
    ownedOutfits: data.ownedOutfits,
    highScores: data.highScores,
    defaultAvatar,
    completeOnboarding,
    updateAvatar,
    setAgeBracket,
    addCoins,
    spendCoins,
    buyHairStyle,
    buyOutfit,
    feed,
    recordGameResult,
    resetProgress,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
