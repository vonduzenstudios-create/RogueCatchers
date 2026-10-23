import type { Inventory } from '../battle/Battle';
import type { Monster } from '../battle/monster';
import type { Facing } from '../gen/characters';
import { START } from '../world/maps';
import type { MapId } from '../world/types';

/** Everything about a playthrough that later gets saved to the browser. */
export interface GameState {
  map: MapId;
  x: number;
  y: number;
  facing: Facing;
  /** Up to six monsters; the first healthy one leads in battle. */
  party: Monster[];
  inventory: Inventory;
  coins: number;
  /** Story progress, e.g. `gotStarter`. */
  flags: Record<string, boolean>;
}

export function newGameState(): GameState {
  return {
    map: START.map,
    x: START.x,
    y: START.y,
    facing: START.facing,
    party: [],
    inventory: { potion: 0, catchOrb: 0 },
    coins: 0,
    flags: {},
  };
}
