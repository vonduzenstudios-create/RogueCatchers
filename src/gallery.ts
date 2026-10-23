import { SPECIES, SPECIES_ORDER } from './data/species';
import { drawBuilding } from './gen/buildings';
import {
  FACINGS,
  GYM_LEADER_OUTFIT,
  type Outfit,
  PLAYER_OUTFIT,
  PROFESSOR_OUTFIT,
  RIVAL_OUTFIT,
  drawCharacterFrames,
  townsfolkOutfit,
} from './gen/characters';
import { generateMonster } from './gen/monsters';
import type { PixelCanvas } from './gen/pixels';
import { TILE_KINDS, drawTileset } from './gen/tiles';
import { drawCatchOrb } from './gen/title';

/** Developer page that shows every generated asset side by side. */
const root = document.getElementById('gallery')!;

function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  root.appendChild(h);
  const row = document.createElement('div');
  row.className = 'row';
  root.appendChild(row);
  return row;
}

function figure(row: HTMLElement, caption: string, canvases: PixelCanvas[], scale: number): void {
  const fig = document.createElement('figure');
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '4px';
  for (const pc of canvases) {
    const c = pc.canvas;
    c.style.width = `${pc.width * scale}px`;
    c.style.height = `${pc.height * scale}px`;
    wrap.appendChild(c);
  }
  fig.appendChild(wrap);
  const cap = document.createElement('figcaption');
  cap.textContent = caption;
  fig.appendChild(cap);
  row.appendChild(fig);
}

const monsters = section('Monsters (front, back)');
for (const id of SPECIES_ORDER) {
  const s = SPECIES[id];
  const art = generateMonster(id);
  figure(monsters, `${s.name} · ${s.type}`, [art.front[0], art.back[0]], 2);
}

const tiles = section('Tiles (4 variants each; water variants are animation frames)');
const tileset = drawTileset();
for (const kind of TILE_KINDS) figure(tiles, kind, tileset[kind], 3);

const buildings = section('Buildings');
for (const kind of ['house', 'lab', 'hospital', 'market', 'gym'] as const) {
  figure(buildings, kind, [drawBuilding(kind).canvas], 3);
}

const people = section('Characters (down, up, left, right; standing and stepping)');
const cast: [string, Outfit][] = [
  ['Player', PLAYER_OUTFIT],
  ['Kael (rival)', RIVAL_OUTFIT],
  ['Professor Alder', PROFESSOR_OUTFIT],
  ['Leader Basalt', GYM_LEADER_OUTFIT],
  ['Townsfolk 1', townsfolkOutfit('npc-1')],
  ['Townsfolk 2', townsfolkOutfit('npc-2')],
  ['Townsfolk 3', townsfolkOutfit('npc-3')],
];
for (const [name, outfit] of cast) {
  const frames = drawCharacterFrames(outfit);
  figure(people, name, FACINGS.flatMap((f) => frames[f]), 3);
}

const items = section('Items');
figure(items, 'Catch Orb', [drawCatchOrb()], 4);
