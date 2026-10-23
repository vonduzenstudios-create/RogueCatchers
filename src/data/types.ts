export const TYPES = ['Fire', 'Water', 'Grass', 'Electric', 'Stone', 'Shadow'] as const;
export type MonsterType = (typeof TYPES)[number];

/** Badge colours for each type, used by the UI. */
export const TYPE_COLORS: Record<MonsterType, string> = {
  Fire: '#e8622c',
  Water: '#3b8fd9',
  Grass: '#4fa84a',
  Electric: '#f2c230',
  Stone: '#9c8466',
  Shadow: '#6b4a9c',
};
