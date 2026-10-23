import type { MoveId, StatusEffect } from '../data/moves';
import { SPECIES, type SpeciesId } from '../data/species';

export const MAX_LEVEL = 20;
export const MAX_MOVES = 4;

/** A monster you or a trainer owns. Plain data, so it can be saved as JSON. */
export interface Monster {
  species: SpeciesId;
  level: number;
  /** Total experience earned. */
  xp: number;
  hp: number;
  moves: MoveId[];
  status: StatusEffect | null;
}

export interface Stats {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
}

export function statsOf(m: Pick<Monster, 'species' | 'level'>): Stats {
  const base = SPECIES[m.species].stats;
  const scale = (b: number) => Math.floor((2 * b * m.level) / 100);
  return {
    maxHp: scale(base.hp) + m.level + 10,
    attack: scale(base.attack) + 5,
    defense: scale(base.defense) + 5,
    speed: scale(base.speed) + 5,
  };
}

/** Experience needed to reach a level (a gentle cubic curve). */
export function xpForLevel(level: number): number {
  return level <= 1 ? 0 : Math.floor((4 * level ** 3) / 5);
}

/** The last four moves a species knows by this level. */
export function movesAtLevel(species: SpeciesId, level: number): MoveId[] {
  const known = SPECIES[species].learnset.filter(([lv]) => lv <= level).map(([, move]) => move);
  return [...new Set(known)].slice(-MAX_MOVES);
}

export function createMonster(species: SpeciesId, level: number): Monster {
  const hp = statsOf({ species, level }).maxHp;
  return { species, level, xp: xpForLevel(level), hp, moves: movesAtLevel(species, level), status: null };
}

export function heal(m: Monster): void {
  m.hp = statsOf(m).maxHp;
  m.status = null;
}

export interface LevelUpResult {
  newLevel: number;
  learned: MoveId[];
}

/**
 * Add experience and apply any level ups. HP rises with max HP so a
 * level up never hurts. Returns one entry per level gained.
 */
export function gainXp(m: Monster, amount: number): LevelUpResult[] {
  const results: LevelUpResult[] = [];
  m.xp += amount;
  while (m.level < MAX_LEVEL && m.xp >= xpForLevel(m.level + 1)) {
    const before = statsOf(m).maxHp;
    m.level++;
    m.hp += statsOf(m).maxHp - before;
    const learned = SPECIES[m.species].learnset
      .filter(([lv, move]) => lv === m.level && !m.moves.includes(move))
      .map(([, move]) => move);
    for (const move of learned) {
      // With four moves already, the oldest one is forgotten.
      if (m.moves.length >= MAX_MOVES) m.moves.shift();
      m.moves.push(move);
    }
    results.push({ newLevel: m.level, learned });
  }
  if (m.level >= MAX_LEVEL) m.xp = Math.min(m.xp, xpForLevel(MAX_LEVEL));
  return results;
}

/** Experience for defeating `foe`; trainer battles pay a bit more. */
export function xpReward(foe: Monster, trainer: boolean): number {
  return Math.floor(((SPECIES[foe.species].xpYield * foe.level) / 5) * (trainer ? 1.5 : 1));
}
