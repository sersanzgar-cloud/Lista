export type AgeBracket = '1-5' | '6-8' | '9-12';

export const ageBrackets: { id: AgeBracket; label: string }[] = [
  { id: '1-5', label: '1 - 5 años' },
  { id: '6-8', label: '6 - 8 años' },
  { id: '9-12', label: '9 - 12 años' },
];

export interface GameMeta {
  id: string;
  ageBracket: AgeBracket;
  title: string;
  description: string;
  emoji: string;
  route: string;
  maxCoins: number;
}

export const games: GameMeta[] = [
  {
    id: 'animal-match',
    ageBracket: '1-5',
    title: 'Encuentra el animal',
    description: 'Toca el animal igual al de arriba',
    emoji: '🐶',
    route: '/games/animal-match',
    maxCoins: 40,
  },
  {
    id: 'memory',
    ageBracket: '6-8',
    title: 'Memoria',
    description: 'Encuentra las parejas iguales',
    emoji: '🧠',
    route: '/games/memory',
    maxCoins: 40,
  },
  {
    id: 'quick-math',
    ageBracket: '9-12',
    title: 'Mates rápidas',
    description: 'Responde tantas cuentas como puedas',
    emoji: '➕',
    route: '/games/quick-math',
    maxCoins: 75,
  },
];

export function gamesForBracket(bracket: AgeBracket): GameMeta[] {
  return games.filter((g) => g.ageBracket === bracket);
}
