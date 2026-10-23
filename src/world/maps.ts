import {
  GYM_LEADER_OUTFIT,
  type Outfit,
  PROFESSOR_OUTFIT,
  RIVAL_OUTFIT,
  townsfolkOutfit,
} from '../gen/characters';
import type { TileKind } from '../gen/tiles';
import { type Door, MapBuilder } from './MapBuilder';
import type { MapData, MapId } from './types';

/*
 * The demo world: Ember Hollow -> Mossway Trail -> Basalt Ridge, plus the
 * interiors behind every door. Coordinates are in tiles from the top left.
 */

const NURSE_OUTFIT: Outfit = { skin: '#f6d2b0', hair: '#e76f8a', shirt: '#f4f1e8', pants: '#f4f1e8', hairStyle: 'long', coat: '#f4f1e8' };
const CLERK_OUTFIT: Outfit = { skin: '#d9a27a', hair: '#2a1e1a', shirt: '#3b8fd9', pants: '#2a2a3a', hat: '#3b8fd9' };

function emberHollow(): MapBuilder {
  const m = new MapBuilder('emberHollow', 'Ember Hollow', 24, 18, 'grass');
  m.border('tree', [[11, 0], [12, 0]]);
  m.rect(11, 0, 2, 16, 'path');
  m.rect(5, 8, 13, 1, 'path');
  m.rect(17, 7, 1, 1, 'path');
  m.rect(5, 7, 1, 1, 'path');
  m.rect(5, 14, 7, 1, 'path');
  m.rect(15, 11, 4, 3, 'water');
  m.rect(14, 15, 6, 1, 'fence');
  m.rect(8, 2, 2, 1, 'tree');
  m.rect(20, 10, 2, 2, 'tree');
  for (const [x, y] of [[2, 2], [7, 10], [9, 12], [20, 4], [21, 14], [14, 10], [2, 16], [8, 16]]) m.set(x, y, 'flowers');

  m.building('lab', 14, 3, 'lab');
  m.building('house', 3, 4, 'playerHouse');
  m.building('house', 3, 11, 'emberHouse');
  m.sign(10, 9, 'EMBER HOLLOW. Where every journey begins.');
  m.sign(13, 1, 'North: Mossway Trail.');

  m.npc({
    id: 'ember-kid',
    name: 'Kid',
    outfit: townsfolkOutfit('ember-kid'),
    x: 8,
    y: 10,
    facing: 'right',
    lines: ["Professor Alder's lab is the big building to the east.", "He's giving out monsters today!"],
  });
  m.npc({
    id: 'ember-fisher',
    name: 'Fisher',
    outfit: townsfolkOutfit('ember-fisher'),
    x: 16,
    y: 10,
    facing: 'down',
    lines: ["Nothing's biting today.", 'I once saw a Glimshade on Mossway Trail at dusk. Gave me chills!'],
  });

  for (const x of [11, 12]) {
    m.gate({
      x,
      y: 2,
      flag: 'beatRivalLab',
      speaker: 'Prof. Alder',
      lines: ["Wait! Tall grass is full of wild monsters.", 'Come to my lab first, east of here!'],
    });
  }

  m.warp(11, 0, 'mosswayTrail', 9, 42, 'up');
  m.warp(12, 0, 'mosswayTrail', 10, 42, 'up');
  return m;
}

function mosswayTrail(): MapBuilder {
  const m = new MapBuilder('mosswayTrail', 'Mossway Trail', 20, 44, 'grass');
  m.border('tree', [[9, 0], [10, 0], [9, 43], [10, 43]]);
  // A winding path from the south gate to the north gate.
  m.rect(9, 34, 2, 10, 'path');
  m.rect(4, 34, 7, 1, 'path');
  m.rect(4, 22, 2, 13, 'path');
  m.rect(4, 22, 11, 1, 'path');
  m.rect(13, 8, 2, 15, 'path');
  m.rect(9, 8, 6, 1, 'path');
  m.rect(9, 0, 2, 9, 'path');

  // Tall grass where wild monsters live.
  m.rect(12, 36, 5, 5, 'tallGrass');
  m.rect(7, 24, 5, 8, 'tallGrass');
  m.rect(15, 12, 3, 8, 'tallGrass');
  m.rect(2, 9, 5, 6, 'tallGrass');
  m.rect(2, 38, 5, 3, 'tallGrass');

  m.rect(15, 25, 3, 4, 'water');
  m.rect(1, 17, 3, 3, 'tree');
  m.rect(16, 3, 2, 3, 'tree');
  m.rect(6, 4, 2, 2, 'tree');
  m.rect(11, 14, 1, 6, 'fence');
  for (const [x, y] of [[13, 31], [7, 37], [2, 31], [16, 22], [7, 16], [12, 3]]) m.set(x, y, 'flowers');

  m.wild([
    { species: 'zapkit', weight: 30, minLevel: 2, maxLevel: 5 },
    { species: 'brambun', weight: 30, minLevel: 2, maxLevel: 5 },
    { species: 'puddlop', weight: 20, minLevel: 3, maxLevel: 5 },
    { species: 'pebblet', weight: 14, minLevel: 3, maxLevel: 6 },
    { species: 'glimshade', weight: 6, minLevel: 4, maxLevel: 6 },
  ]);
  m.sign(11, 41, 'MOSSWAY TRAIL. North: Basalt Ridge. Tall grass hides wild monsters!');

  m.npc({
    id: 'trainer-wren',
    name: 'Bug Catcher Wren',
    outfit: townsfolkOutfit('wren'),
    x: 3,
    y: 28,
    facing: 'right',
    lines: ["I've been catching monsters in this grass all morning!", "Let's battle once you have a partner of your own."],
  });
  m.npc({
    id: 'trainer-moss',
    name: 'Hiker Moss',
    outfit: townsfolkOutfit('moss'),
    x: 15,
    y: 10,
    facing: 'left',
    lines: ['Basalt Ridge is just north of here.', "Its gym leader uses Stone types. Bring Water or Grass if you've got them!"],
  });

  m.warp(9, 43, 'emberHollow', 11, 1, 'down');
  m.warp(10, 43, 'emberHollow', 12, 1, 'down');
  m.warp(9, 0, 'basaltRidge', 13, 20, 'up');
  m.warp(10, 0, 'basaltRidge', 14, 20, 'up');
  return m;
}

function basaltRidge(): MapBuilder {
  const m = new MapBuilder('basaltRidge', 'Basalt Ridge', 28, 22, 'sand');
  m.border('rock', [[13, 21], [14, 21]]);
  m.rect(13, 6, 2, 16, 'path');
  m.rect(5, 11, 1, 2, 'path');
  m.rect(5, 12, 9, 1, 'path');
  m.rect(22, 11, 1, 2, 'path');
  m.rect(14, 12, 9, 1, 'path');
  m.rect(5, 18, 1, 1, 'path');
  m.rect(5, 18, 9, 1, 'path');
  m.rect(22, 18, 1, 1, 'path');
  m.rect(14, 18, 9, 1, 'path');
  m.rect(9, 14, 3, 2, 'grass');
  m.rect(17, 14, 2, 2, 'grass');
  for (const [x, y] of [[9, 9], [18, 4], [25, 13], [8, 19], [19, 20], [2, 4], [25, 3]]) m.set(x, y, 'rock');

  m.building('gym', 11, 2, 'gym');
  m.building('hospital', 3, 7, 'hospital');
  m.building('market', 20, 7, 'market');
  m.building('house', 3, 15, 'basaltHouseWest');
  m.building('house', 20, 15, 'basaltHouseEast');
  m.sign(12, 19, 'BASALT RIDGE. A town carved from stone.');
  m.sign(16, 6, 'BASALT GYM. Leader: Basalt, the rock-solid trainer!');

  m.npc({
    id: 'basalt-shopper',
    name: 'Shopper',
    outfit: townsfolkOutfit('basalt-shopper'),
    x: 18,
    y: 11,
    facing: 'down',
    lines: ['The Market sells Catch Orbs and potions.', 'Win battles to earn coins!'],
  });
  m.npc({
    id: 'basalt-miner',
    name: 'Miner',
    outfit: townsfolkOutfit('basalt-miner'),
    x: 9,
    y: 13,
    facing: 'right',
    lines: ['Leader Basalt only uses Stone types.', 'Water and Grass moves crumble rock!'],
  });
  m.npc({
    id: 'basalt-elder',
    name: 'Elder',
    outfit: townsfolkOutfit('basalt-elder'),
    x: 8,
    y: 6,
    facing: 'down',
    lines: ['Hurt monsters? The Monster Hospital heals them for free.'],
  });

  m.warp(13, 21, 'mosswayTrail', 9, 1, 'down');
  m.warp(14, 21, 'mosswayTrail', 10, 1, 'down');
  return m;
}

/** An indoor room: back wall along the top, a door mat in the middle of the bottom row. */
function room(id: MapId, name: string, w: number, h: number, floor: TileKind): MapBuilder {
  const m = new MapBuilder(id, name, w, h, floor, true);
  m.rect(0, 0, w, 2, 'wall');
  m.set(Math.floor(w / 2), h - 1, 'mat');
  return m;
}

function lab(): MapBuilder {
  const m = room('lab', "Professor Alder's Lab", 12, 10, 'floor');
  m.rect(1, 1, 2, 1, 'shelf');
  m.rect(9, 1, 2, 1, 'shelf');
  m.set(4, 1, 'machine');
  m.set(7, 1, 'machine');
  m.rect(5, 4, 3, 1, 'table');
  m.set(0, 8, 'plant');
  m.set(11, 8, 'plant');
  m.rect(1, 6, 1, 2, 'shelf');
  m.rect(10, 6, 1, 2, 'shelf');
  m.npc({
    id: 'professor',
    name: 'Prof. Alder',
    outfit: PROFESSOR_OUTFIT,
    x: 6,
    y: 3,
    facing: 'down',
    lines: [
      "Ah, there you are! I'm Professor Alder.",
      'On this table are three monsters: Embrit, Splashell and Sproutle.',
      'Soon you will choose one as your partner. Choose wisely!',
    ],
  });
  m.npc({
    id: 'rival',
    name: 'Kael',
    outfit: RIVAL_OUTFIT,
    x: 3,
    y: 5,
    facing: 'right',
    lines: ["Hey, I'm Kael. The Professor said I get a monster too.", "Whatever you pick, I'll pick something better!"],
    hiddenWhen: 'beatRivalLab',
  });
  return m;
}

function playerHouse(): MapBuilder {
  const m = room('playerHouse', 'Your House', 8, 7, 'floor');
  m.rect(1, 1, 2, 1, 'shelf');
  m.rect(2, 3, 2, 1, 'table');
  m.set(7, 2, 'plant');
  m.rect(3, 5, 3, 1, 'rug');
  m.npc({
    id: 'mom',
    name: 'Mom',
    outfit: townsfolkOutfit('mom'),
    x: 5,
    y: 3,
    facing: 'down',
    lines: ['Professor Alder is waiting for you at the lab.', 'Be careful out there, and come home if you get tired!'],
  });
  return m;
}

function cottage(id: MapId, name: string, seed: string, lines: string[]): MapBuilder {
  const m = room(id, name, 8, 7, 'floor');
  m.rect(5, 1, 2, 1, 'shelf');
  m.set(2, 3, 'table');
  m.set(0, 5, 'plant');
  m.npc({ id: `${id}-resident`, name: 'Resident', outfit: townsfolkOutfit(seed), x: 3, y: 3, facing: 'down', lines });
  return m;
}

function hospital(): MapBuilder {
  const m = room('hospital', 'Monster Hospital', 10, 8, 'tileFloor');
  m.rect(3, 3, 4, 1, 'counter');
  m.set(7, 2, 'machine');
  m.set(0, 2, 'plant');
  m.set(9, 2, 'plant');
  m.npc({
    id: 'nurse',
    name: 'Nurse Poppy',
    outfit: NURSE_OUTFIT,
    x: 4,
    y: 2,
    facing: 'down',
    lines: ['Welcome to the Monster Hospital!', "Once you have monsters, I'll heal them right up, free of charge."],
  });
  return m;
}

function market(): MapBuilder {
  const m = room('market', 'Market', 10, 8, 'floor');
  m.rect(1, 1, 2, 1, 'shelf');
  m.rect(7, 1, 2, 1, 'shelf');
  m.rect(1, 4, 2, 1, 'shelf');
  m.rect(7, 4, 2, 1, 'shelf');
  m.rect(4, 3, 2, 1, 'counter');
  m.npc({
    id: 'clerk',
    name: 'Clerk',
    outfit: CLERK_OUTFIT,
    x: 4,
    y: 2,
    facing: 'down',
    lines: ['Welcome to the Market!', 'We stock Catch Orbs and Potions. Come back once you have some coins.'],
  });
  return m;
}

function gym(): MapBuilder {
  const m = room('gym', 'Basalt Gym', 10, 14, 'stoneFloor');
  for (const y of [4, 8]) {
    m.set(1, y, 'statue');
    m.set(8, y, 'statue');
  }
  m.set(3, 2, 'statue');
  m.set(6, 2, 'statue');
  m.npc({
    id: 'leader-basalt',
    name: 'Leader Basalt',
    outfit: GYM_LEADER_OUTFIT,
    x: 5,
    y: 2,
    facing: 'down',
    lines: ["I'm Basalt, leader of this gym.", 'My Stone monsters are as solid as the ridge itself.', 'Come back when you have a team worth testing!'],
  });
  m.npc({
    id: 'gym-trainer',
    name: 'Climber Flint',
    outfit: townsfolkOutfit('flint'),
    x: 3,
    y: 7,
    facing: 'right',
    lines: ['You want to see Leader Basalt?', "You'll have to get past me first. Well, once battles open up!"],
  });
  return m;
}

/** Connect every door to its interior: in through the door, out over the mat. */
function linkDoors(builders: Map<MapId, MapBuilder>): void {
  for (const outside of builders.values()) {
    for (const door of outside.doors) linkDoor(door, outside, builders.get(door.interior)!);
  }
}

function linkDoor(door: Door, outside: MapBuilder, inside: MapBuilder): void {
  const matX = Math.floor(inside.width / 2);
  const matY = inside.height - 1;
  outside.warp(door.x, door.y, inside.id, matX, matY - 1, 'up');
  inside.warp(matX, matY, outside.id, door.x, door.y + 1, 'down');
}

function buildWorld(): Record<MapId, MapData> {
  const all = [
    emberHollow(),
    mosswayTrail(),
    basaltRidge(),
    lab(),
    playerHouse(),
    cottage('emberHouse', 'Cottage', 'ember-elder', ['Back in my day we caught monsters with our bare hands!', 'Well, not really. But it sounds good.']),
    hospital(),
    market(),
    gym(),
    cottage('basaltHouseWest', 'Stone House', 'basalt-west', ['My Pebblet keeps eating the garden rocks.']),
    cottage('basaltHouseEast', 'Stone House', 'basalt-east', ['The gym is at the top of town. Good luck!']),
  ];
  const builders = new Map(all.map((b) => [b.id, b]));
  linkDoors(builders);
  return Object.fromEntries(all.map((b) => [b.id, b.build()])) as Record<MapId, MapData>;
}

export const WORLD: Record<MapId, MapData> = buildWorld();

/** Where a new game starts: outside your house in Ember Hollow. */
export const START = { map: 'emberHollow' as MapId, x: 5, y: 7, facing: 'down' as const };
