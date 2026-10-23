import type { SpeciesId } from '../data/species';
import type { BuildingKind } from '../gen/buildings';
import type { Facing, Outfit } from '../gen/characters';
import type { TileKind } from '../gen/tiles';

export type MapId =
  | 'emberHollow'
  | 'mosswayTrail'
  | 'basaltRidge'
  | 'lab'
  | 'playerHouse'
  | 'emberHouse'
  | 'hospital'
  | 'market'
  | 'gym'
  | 'basaltHouseWest'
  | 'basaltHouseEast';

export interface PlacedBuilding {
  kind: BuildingKind;
  /** Top-left tile. */
  x: number;
  y: number;
  /** Seed for the building's look, so houses differ. */
  seed: string;
}

export interface NpcDef {
  id: string;
  name: string;
  outfit: Outfit;
  x: number;
  y: number;
  facing: Facing;
  lines: string[];
  /** Only present once this story flag is set. */
  shownWhen?: string;
  /** Gone once this story flag is set. */
  hiddenWhen?: string;
}

/** A tile you can't pass until a story flag is set; you're told why and stepped back. */
export interface Gate {
  x: number;
  y: number;
  flag: string;
  speaker?: string;
  lines: string[];
}

export interface EncounterSlot {
  species: SpeciesId;
  weight: number;
  minLevel: number;
  maxLevel: number;
}

export interface Warp {
  x: number;
  y: number;
  to: MapId;
  toX: number;
  toY: number;
  facing: Facing;
}

export interface SignDef {
  x: number;
  y: number;
  text: string;
}

export interface MapData {
  id: MapId;
  name: string;
  width: number;
  height: number;
  indoor: boolean;
  tiles: TileKind[][];
  buildings: PlacedBuilding[];
  npcs: NpcDef[];
  signs: SignDef[];
  warps: Warp[];
  gates: Gate[];
  /** Wild monsters found in this map's tall grass. */
  encounters: EncounterSlot[];
}
