import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Avatar from '../src/components/Avatar';
import PrimaryButton from '../src/components/PrimaryButton';
import { FREE_HAIR_STYLES, HairStyleId } from '../src/data/catalog';
import { AgeBracket, ageBrackets } from '../src/data/games';
import { AvatarConfig, useApp } from '../src/state/AppContext';
import { colors, eyeColors, hairColors, skinTones } from '../src/theme/colors';

const hairStyleLabels: Record<HairStyleId, string> = {
  short: 'Corto',
  ponytail: 'Coleta',
  curly: 'Rizado',
  mohawk: 'Mohawk',
  long: 'Largo',
};

function Swatch({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.swatch,
        { backgroundColor: color },
        selected && styles.swatchSelected,
      ]}
    />
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { defaultAvatar, completeOnboarding } = useApp();
  const [avatar, setAvatar] = useState<AvatarConfig>(defaultAvatar);
  const [ageBracket, setAgeBracketLocal] = useState<AgeBracket | null>(null);

  const canSubmit = avatar.name.trim().length > 0 && ageBracket !== null;

  function handleSubmit() {
    if (!canSubmit || !ageBracket) return;
    completeOnboarding({ ...avatar, name: avatar.name.trim() }, ageBracket);
    router.replace('/');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>¡Crea a tu compañero!</Text>

      <View style={styles.avatarPreview}>
        <Avatar avatar={avatar} size={160} mood={80} />
      </View>

      <TextInput
        value={avatar.name}
        onChangeText={(name) => setAvatar((a) => ({ ...a, name }))}
        placeholder="¿Cómo se llama?"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        maxLength={16}
      />

      <Text style={styles.label}>Color de piel</Text>
      <View style={styles.row}>
        {skinTones.map((c) => (
          <Swatch key={c} color={c} selected={avatar.skinTone === c} onPress={() => setAvatar((a) => ({ ...a, skinTone: c }))} />
        ))}
      </View>

      <Text style={styles.label}>Peinado</Text>
      <View style={styles.row}>
        {FREE_HAIR_STYLES.map((style) => (
          <Pressable
            key={style}
            onPress={() => setAvatar((a) => ({ ...a, hairStyle: style }))}
            style={[styles.optionChip, avatar.hairStyle === style && styles.optionChipSelected]}
          >
            <Text style={[styles.optionChipText, avatar.hairStyle === style && styles.optionChipTextSelected]}>
              {hairStyleLabels[style]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Color de pelo</Text>
      <View style={styles.row}>
        {hairColors.map((c) => (
          <Swatch key={c} color={c} selected={avatar.hairColor === c} onPress={() => setAvatar((a) => ({ ...a, hairColor: c }))} />
        ))}
      </View>

      <Text style={styles.label}>Color de ojos</Text>
      <View style={styles.row}>
        {eyeColors.map((c) => (
          <Swatch key={c} color={c} selected={avatar.eyeColor === c} onPress={() => setAvatar((a) => ({ ...a, eyeColor: c }))} />
        ))}
      </View>

      <Text style={styles.label}>¿Qué edad tienes?</Text>
      <View style={styles.row}>
        {ageBrackets.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => setAgeBracketLocal(b.id)}
            style={[styles.optionChip, ageBracket === b.id && styles.optionChipSelected]}
          >
            <Text style={[styles.optionChipText, ageBracket === b.id && styles.optionChipTextSelected]}>{b.label}</Text>
          </Pressable>
        ))}
      </View>

      <PrimaryButton label="Empezar la aventura" onPress={handleSubmit} disabled={!canSubmit} style={styles.submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 60,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  avatarPreview: {
    marginBottom: 16,
  },
  input: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  label: {
    alignSelf: 'flex-start',
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: colors.text,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionChipText: {
    color: colors.text,
    fontWeight: '700',
  },
  optionChipTextSelected: {
    color: '#FFFFFF',
  },
  submit: {
    width: '100%',
    marginTop: 24,
  },
});
