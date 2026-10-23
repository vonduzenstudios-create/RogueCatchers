import type { MonsterType } from './types';

/**
 * Attack multipliers: TYPE_CHART[attacker][defender].
 * Matches the table in the game plan.
 */
export const TYPE_CHART: Record<MonsterType, Record<MonsterType, number>> = {
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Electric: 1, Stone: 0.5, Shadow: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Electric: 1, Stone: 2, Shadow: 1 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Electric: 1, Stone: 2, Shadow: 0.5 },
  Electric: { Fire: 1, Water: 2, Grass: 0.5, Electric: 0.5, Stone: 0.5, Shadow: 2 },
  Stone: { Fire: 2, Water: 1, Grass: 0.5, Electric: 2, Stone: 1, Shadow: 1 },
  Shadow: { Fire: 0.5, Water: 1, Grass: 2, Electric: 0.5, Stone: 1, Shadow: 2 },
};

export function effectiveness(attack: MonsterType, defender: MonsterType): number {
  return TYPE_CHART[attack][defender];
}
