import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import ScreenHeader from '../src/components/ScreenHeader';
import PrimaryButton from '../src/components/PrimaryButton';
import { ageBrackets } from '../src/data/games';
import { useApp } from '../src/state/AppContext';
import { colors, eyeColors, skinTones } from '../src/theme/colors';
import { confirmDialog } from '../src/utils/alerts';

export default function Settings() {
  const router = useRouter();
  const { avatar, ageBracket, updateAvatar, setAgeBracket, resetProgress } = useApp();
  const [name, setName] = useState(avatar?.name ?? '');

  if (!avatar) return null;

  function handleRename() {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      updateAvatar({ name: trimmed });
    }
  }

  async function handleReset() {
    const confirmed = await confirmDialog(
      'Empezar de nuevo',
      'Se borrará todo el progreso: monedas, ropa y el compañero. ¿Seguro?',
    );
    if (confirmed) {
      resetProgress();
      router.replace('/onboarding');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Ajustes" />

      <Text style={styles.label}>Nombre</Text>
      <View style={styles.renameRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={handleRename}
          style={styles.input}
          maxLength={16}
        />
        <PrimaryButton label="Guardar" onPress={handleRename} style={styles.saveButton} />
      </View>

      <Text style={styles.label}>Color de piel</Text>
      <View style={styles.row}>
        {skinTones.map((c) => (
          <Pressable
            key={c}
            onPress={() => updateAvatar({ skinTone: c })}
            style={[styles.swatch, { backgroundColor: c }, avatar.skinTone === c && styles.swatchSelected]}
          />
        ))}
      </View>

      <Text style={styles.label}>Color de ojos</Text>
      <View style={styles.row}>
        {eyeColors.map((c) => (
          <Pressable
            key={c}
            onPress={() => updateAvatar({ eyeColor: c })}
            style={[styles.swatch, { backgroundColor: c }, avatar.eyeColor === c && styles.swatchSelected]}
          />
        ))}
      </View>

      <Text style={styles.label}>Edad</Text>
      <View style={styles.row}>
        {ageBrackets.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => setAgeBracket(b.id)}
            style={[styles.optionChip, ageBracket === b.id && styles.optionChipSelected]}
          >
            <Text style={[styles.optionChipText, ageBracket === b.id && styles.optionChipTextSelected]}>{b.label}</Text>
          </Pressable>
        ))}
      </View>

      <PrimaryButton label="Empezar de nuevo" onPress={handleReset} variant="outline" style={styles.resetButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 18,
    marginBottom: 8,
  },
  renameRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  saveButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  resetButton: {
    marginTop: 32,
  },
});
