import type { MonsterType } from './types';

export type StatusEffect = 'burn' | 'poison' | 'paralysis' | 'sleep';
export type StatStage = 'attack' | 'defense' | 'speed';

export interface MoveData {
  id: MoveId;
  name: string;
  type: MonsterType;
  /** 0 for moves that only cause an effect. */
  power: number;
  /** Hit chance in percent. */
  accuracy: number;
  description: string;
  /** Chance in percent to inflict a status on the target. */
  inflicts?: { status: StatusEffect; chance: number };
  /** Raise the user's stat, or lower the target's, by one stage. */
  boost?: { stat: StatStage; target: 'self' | 'foe'; stages: number };
}

export type MoveId =
  | 'ember'
  | 'flameWheel'
  | 'fireFang'
  | 'bubble'
  | 'waterPulse'
  | 'tidalSlam'
  | 'vineWhip'
  | 'leafBlade'
  | 'sporeDust'
  | 'spark'
  | 'thunderFang'
  | 'staticWave'
  | 'pebbleToss'
  | 'rockSlam'
  | 'harden'
  | 'shadeClaw'
  | 'nightGust'
  | 'toxicMist'
  | 'growl'
  | 'quickStep';

const m = (data: MoveData): MoveData => data;

export const MOVES: Record<MoveId, MoveData> = {
  ember: m({ id: 'ember', name: 'Ember', type: 'Fire', power: 40, accuracy: 100, description: 'A small flame. May burn.', inflicts: { status: 'burn', chance: 10 } }),
  flameWheel: m({ id: 'flameWheel', name: 'Flame Wheel', type: 'Fire', power: 60, accuracy: 100, description: 'Rolls in fire. May burn.', inflicts: { status: 'burn', chance: 10 } }),
  fireFang: m({ id: 'fireFang', name: 'Fire Fang', type: 'Fire', power: 75, accuracy: 90, description: 'A blazing bite.' }),
  bubble: m({ id: 'bubble', name: 'Bubble', type: 'Water', power: 40, accuracy: 100, description: 'A spray of bubbles.' }),
  waterPulse: m({ id: 'waterPulse', name: 'Water Pulse', type: 'Water', power: 60, accuracy: 100, description: 'A pulsing blast of water.' }),
  tidalSlam: m({ id: 'tidalSlam', name: 'Tidal Slam', type: 'Water', power: 80, accuracy: 85, description: 'Crashes down like a wave.' }),
  vineWhip: m({ id: 'vineWhip', name: 'Vine Whip', type: 'Grass', power: 45, accuracy: 100, description: 'Lashes with vines.' }),
  leafBlade: m({ id: 'leafBlade', name: 'Leaf Blade', type: 'Grass', power: 70, accuracy: 95, description: 'Slices with a sharp leaf.' }),
  sporeDust: m({ id: 'sporeDust', name: 'Spore Dust', type: 'Grass', power: 0, accuracy: 75, description: 'Puts the foe to sleep.', inflicts: { status: 'sleep', chance: 100 } }),
  spark: m({ id: 'spark', name: 'Spark', type: 'Electric', power: 40, accuracy: 100, description: 'A jolt. May paralyze.', inflicts: { status: 'paralysis', chance: 10 } }),
  thunderFang: m({ id: 'thunderFang', name: 'Thunder Fang', type: 'Electric', power: 65, accuracy: 95, description: 'A crackling bite.' }),
  staticWave: m({ id: 'staticWave', name: 'Static Wave', type: 'Electric', power: 0, accuracy: 90, description: 'Paralyzes the foe.', inflicts: { status: 'paralysis', chance: 100 } }),
  pebbleToss: m({ id: 'pebbleToss', name: 'Pebble Toss', type: 'Stone', power: 40, accuracy: 100, description: 'Flings small stones.' }),
  rockSlam: m({ id: 'rockSlam', name: 'Rock Slam', type: 'Stone', power: 75, accuracy: 90, description: 'Slams with a heavy boulder.' }),
  harden: m({ id: 'harden', name: 'Harden', type: 'Stone', power: 0, accuracy: 100, description: "Raises the user's Defense.", boost: { stat: 'defense', target: 'self', stages: 1 } }),
  shadeClaw: m({ id: 'shadeClaw', name: 'Shade Claw', type: 'Shadow', power: 45, accuracy: 100, description: 'A swipe from the shadows.' }),
  nightGust: m({ id: 'nightGust', name: 'Night Gust', type: 'Shadow', power: 65, accuracy: 100, description: 'A chilling dark wind.' }),
  toxicMist: m({ id: 'toxicMist', name: 'Toxic Mist', type: 'Shadow', power: 0, accuracy: 85, description: 'Poisons the foe.', inflicts: { status: 'poison', chance: 100 } }),
  growl: m({ id: 'growl', name: 'Growl', type: 'Fire', power: 0, accuracy: 100, description: "Lowers the foe's Attack.", boost: { stat: 'attack', target: 'foe', stages: -1 } }),
  quickStep: m({ id: 'quickStep', name: 'Quick Step', type: 'Electric', power: 0, accuracy: 100, description: "Raises the user's Speed.", boost: { stat: 'speed', target: 'self', stages: 1 } }),
};
