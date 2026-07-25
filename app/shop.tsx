import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import ScreenHeader from '../src/components/ScreenHeader';
import { foodCatalog, hairCatalog, outfitCatalog } from '../src/data/catalog';
import { useApp } from '../src/state/AppContext';
import { colors } from '../src/theme/colors';
import { notify } from '../src/utils/alerts';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function Shop() {
  const {
    avatar,
    coins,
    mood,
    ownedHairStyles,
    ownedOutfits,
    buyHairStyle,
    buyOutfit,
    feed,
    updateAvatar,
  } = useApp();

  if (!avatar) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Tienda" showCoins />

      <SectionTitle>💇 Peinados</SectionTitle>
      <View style={styles.grid}>
        {hairCatalog.map((item) => {
          const owned = ownedHairStyles.includes(item.styleId);
          const equipped = avatar.hairStyle === item.styleId;
          return (
            <Pressable
              key={item.id}
              style={[styles.item, equipped && styles.itemEquipped]}
              onPress={() => {
                if (equipped) return;
                if (owned) {
                  updateAvatar({ hairStyle: item.styleId });
                } else if (!buyHairStyle(item.styleId, item.price)) {
                  notify('Monedas insuficientes', 'Juega a los minijuegos para conseguir más monedas.');
                } else {
                  updateAvatar({ hairStyle: item.styleId });
                }
              }}
            >
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemAction}>{equipped ? 'Puesto' : owned ? 'Equipar' : `${item.price} 🪙`}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>👕 Ropa</SectionTitle>
      <View style={styles.grid}>
        {outfitCatalog.map((item) => {
          const owned = ownedOutfits.includes(item.outfitId);
          const equipped = avatar.outfitId === item.outfitId;
          return (
            <Pressable
              key={item.id}
              style={[styles.item, equipped && styles.itemEquipped]}
              onPress={() => {
                if (equipped) return;
                if (owned) {
                  updateAvatar({ outfitId: item.outfitId });
                } else if (!buyOutfit(item.outfitId, item.price)) {
                  notify('Monedas insuficientes', 'Juega a los minijuegos para conseguir más monedas.');
                } else {
                  updateAvatar({ outfitId: item.outfitId });
                }
              }}
            >
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemAction}>{equipped ? 'Puesto' : owned ? 'Equipar' : `${item.price} 🪙`}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>🍽️ Comida (ánimo: {mood}%)</SectionTitle>
      <View style={styles.grid}>
        {foodCatalog.map((item) => (
          <Pressable
            key={item.id}
            style={styles.item}
            onPress={() => {
              if (mood >= 100) {
                notify('¡Ya está lleno!', `${avatar.name} no tiene más hambre ahora mismo.`);
                return;
              }
              if (!feed(item.moodGain, item.price)) {
                notify('Monedas insuficientes', 'Juega a los minijuegos para conseguir más monedas.');
              }
            }}
          >
            <Text style={styles.foodEmoji}>{item.emoji}</Text>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemAction}>{item.price} 🪙</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.coinsFooter}>Tienes {coins} monedas</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
  },
  item: {
    width: 108,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
  },
  itemEquipped: {
    borderColor: colors.accent,
    backgroundColor: '#E9F7DA',
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 6,
  },
  foodEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  itemAction: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 6,
  },
  coinsFooter: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 20,
    fontSize: 13,
  },
});
