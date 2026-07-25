export type HairStyleId = 'short' | 'ponytail' | 'curly' | 'mohawk' | 'long';
export type OutfitId = 'basic-tee' | 'red-tee' | 'blue-dress' | 'superhero' | 'star-pajama';

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  kind: 'hair' | 'outfit' | 'food';
}

export interface HairCatalogItem extends ShopItem {
  kind: 'hair';
  styleId: HairStyleId;
}

export interface OutfitCatalogItem extends ShopItem {
  kind: 'outfit';
  outfitId: OutfitId;
  color: string;
}

export interface FoodCatalogItem extends ShopItem {
  kind: 'food';
  moodGain: number;
  emoji: string;
}

export const FREE_HAIR_STYLES: HairStyleId[] = ['short', 'ponytail'];
export const FREE_OUTFITS: OutfitId[] = ['basic-tee'];

export const hairCatalog: HairCatalogItem[] = [
  { id: 'hair-curly', name: 'Pelo rizado', price: 15, kind: 'hair', styleId: 'curly' },
  { id: 'hair-mohawk', name: 'Mohawk', price: 40, kind: 'hair', styleId: 'mohawk' },
  { id: 'hair-long', name: 'Pelo largo', price: 25, kind: 'hair', styleId: 'long' },
];

export const outfitCatalog: OutfitCatalogItem[] = [
  { id: 'outfit-red-tee', name: 'Camiseta roja', price: 20, kind: 'outfit', outfitId: 'red-tee', color: '#E5484D' },
  { id: 'outfit-blue-dress', name: 'Vestido azul', price: 30, kind: 'outfit', outfitId: 'blue-dress', color: '#4EA8DE' },
  { id: 'outfit-superhero', name: 'Traje de superhéroe', price: 60, kind: 'outfit', outfitId: 'superhero', color: '#8A4FE0' },
  { id: 'outfit-star-pajama', name: 'Pijama de estrellas', price: 25, kind: 'outfit', outfitId: 'star-pajama', color: '#2B2A4C' },
];

export const foodCatalog: FoodCatalogItem[] = [
  { id: 'food-apple', name: 'Manzana', price: 10, kind: 'food', moodGain: 20, emoji: '🍎' },
  { id: 'food-pizza', name: 'Pizza', price: 20, kind: 'food', moodGain: 40, emoji: '🍕' },
  { id: 'food-icecream', name: 'Helado', price: 35, kind: 'food', moodGain: 60, emoji: '🍦' },
];

export function findOutfit(outfitId: OutfitId): OutfitCatalogItem | undefined {
  return outfitCatalog.find((o) => o.outfitId === outfitId);
}
