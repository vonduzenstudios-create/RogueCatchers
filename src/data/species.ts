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

export interface Species {
  id: SpeciesId;
  name: string;
  type: MonsterType;
  role: SpeciesRole;
  description: string;
}

export const SPECIES: Record<SpeciesId, Species> = {
  embrit: { id: 'embrit', name: 'Embrit', type: 'Fire', role: 'starter', description: 'A small fox whose tail tip smoulders like a coal.' },
  splashell: { id: 'splashell', name: 'Splashell', type: 'Water', role: 'starter', description: 'A round turtle that steers with the fin on its head.' },
  sproutle: { id: 'sproutle', name: 'Sproutle', type: 'Grass', role: 'starter', description: 'A lizard that sunbathes to grow its leaf crest.' },
  zapkit: { id: 'zapkit', name: 'Zapkit', type: 'Electric', role: 'wild', description: 'Its antennae spark when it is excited.' },
  puddlop: { id: 'puddlop', name: 'Puddlop', type: 'Water', role: 'wild', description: 'A squat frog that keeps a droplet balanced on its head.' },
  brambun: { id: 'brambun', name: 'Brambun', type: 'Grass', role: 'wild', description: 'A rabbit with thorny ears that hides in bramble.' },
  pebblet: { id: 'pebblet', name: 'Pebblet', type: 'Stone', role: 'wild', description: 'A beetle with a shell as hard as river stone.' },
  glimshade: { id: 'glimshade', name: 'Glimshade', type: 'Shadow', role: 'wild', description: 'A one-eyed wisp only seen at dusk.' },
  cragmaw: { id: 'cragmaw', name: 'Cragmaw', type: 'Stone', role: 'gym', description: 'A living boulder with a jaw that crushes rock.' },
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
