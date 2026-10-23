import type { MoveId } from './moves';
import type { MonsterType } from './types';

export type SpeciesId =
  | 'embrit'
  | 'splashell'
  | 'sproutle'
  | 'zapkit'
  | 'puddlop'
  | 'brambun'
  | 'pebblet'
  | 'glimshade'
  | 'cragmaw';

export type SpeciesRole = 'starter' | 'wild' | 'gym';

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface Species {
  id: SpeciesId;
  name: string;
  type: MonsterType;
  role: SpeciesRole;
  description: string;
  stats: BaseStats;
  /** Moves learned at each level; a new monster knows the last four it qualifies for. */
  learnset: [level: number, move: MoveId][];
  /** 0 to 255; higher is easier to catch. */
  catchRate: number;
  /** Base experience given when defeated. */
  xpYield: number;
}

const st = (hp: number, attack: number, defense: number, speed: number): BaseStats => ({ hp, attack, defense, speed });

export const SPECIES: Record<SpeciesId, Species> = {
  embrit: {
    id: 'embrit', name: 'Embrit', type: 'Fire', role: 'starter',
    description: 'A small fox whose tail tip smoulders like a coal.',
    stats: st(45, 60, 45, 65), catchRate: 45, xpYield: 62,
    learnset: [[1, 'ember'], [1, 'growl'], [7, 'quickStep'], [11, 'flameWheel'], [16, 'fireFang']],
  },
  splashell: {
    id: 'splashell', name: 'Splashell', type: 'Water', role: 'starter',
    description: 'A round turtle that steers with the fin on its head.',
    stats: st(50, 50, 62, 43), catchRate: 45, xpYield: 63,
    learnset: [[1, 'bubble'], [1, 'harden'], [7, 'growl'], [11, 'waterPulse'], [16, 'tidalSlam']],
  },
  sproutle: {
    id: 'sproutle', name: 'Sproutle', type: 'Grass', role: 'starter',
    description: 'A lizard that sunbathes to grow its leaf crest.',
    stats: st(48, 52, 52, 55), catchRate: 45, xpYield: 64,
    learnset: [[1, 'vineWhip'], [1, 'growl'], [7, 'sporeDust'], [11, 'pebbleToss'], [16, 'leafBlade']],
  },
  zapkit: {
    id: 'zapkit', name: 'Zapkit', type: 'Electric', role: 'wild',
    description: 'Its antennae spark when it is excited.',
    stats: st(38, 52, 38, 75), catchRate: 190, xpYield: 55,
    learnset: [[1, 'spark'], [1, 'quickStep'], [8, 'staticWave'], [13, 'thunderFang']],
  },
  puddlop: {
    id: 'puddlop', name: 'Puddlop', type: 'Water', role: 'wild',
    description: 'A squat frog that keeps a droplet balanced on its head.',
    stats: st(55, 45, 50, 40), catchRate: 190, xpYield: 56,
    learnset: [[1, 'bubble'], [1, 'growl'], [9, 'waterPulse'], [14, 'harden']],
  },
  brambun: {
    id: 'brambun', name: 'Brambun', type: 'Grass', role: 'wild',
    description: 'A rabbit with thorny ears that hides in bramble.',
    stats: st(44, 50, 42, 62), catchRate: 190, xpYield: 55,
    learnset: [[1, 'vineWhip'], [1, 'quickStep'], [9, 'sporeDust'], [14, 'leafBlade']],
  },
  pebblet: {
    id: 'pebblet', name: 'Pebblet', type: 'Stone', role: 'wild',
    description: 'A beetle with a shell as hard as river stone.',
    stats: st(45, 55, 70, 30), catchRate: 150, xpYield: 60,
    learnset: [[1, 'pebbleToss'], [1, 'harden'], [10, 'rockSlam'], [15, 'growl']],
  },
  glimshade: {
    id: 'glimshade', name: 'Glimshade', type: 'Shadow', role: 'wild',
    description: 'A one-eyed wisp only seen at dusk.',
    stats: st(40, 58, 40, 68), catchRate: 90, xpYield: 70,
    learnset: [[1, 'shadeClaw'], [1, 'toxicMist'], [10, 'nightGust'], [15, 'growl']],
  },
  cragmaw: {
    id: 'cragmaw', name: 'Cragmaw', type: 'Stone', role: 'gym',
    description: 'A living boulder with a jaw that crushes rock.',
    stats: st(70, 75, 80, 30), catchRate: 30, xpYield: 110,
    learnset: [[1, 'pebbleToss'], [1, 'harden'], [8, 'growl'], [12, 'rockSlam']],
  },
};

export const SPECIES_ORDER: SpeciesId[] = [
  'embrit',
  'splashell',
  'sproutle',
  'zapkit',
  'puddlop',
  'brambun',
  'pebblet',
  'glimshade',
  'cragmaw',
];
