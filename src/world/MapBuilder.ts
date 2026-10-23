import { type BuildingKind, buildingSize } from '../gen/buildings';
import type { Facing } from '../gen/characters';
import type { TileKind } from '../gen/tiles';
import type { MapData, MapId, NpcDef, PlacedBuilding, SignDef, Warp } from './types';

/** A door that leads into an interior map, connected up by `linkDoors`. */
export interface Door {
  map: MapId;
  x: number;
  y: number;
  interior: MapId;
}

/**
 * Small helper for laying out maps in code with explicit coordinates.
 * Coordinates are in tiles, (0, 0) is the top left.
 */
export class MapBuilder {
  private tiles: TileKind[][];
  private buildings: PlacedBuilding[] = [];
  private npcs: NpcDef[] = [];
  private signs: SignDef[] = [];
  private warps: Warp[] = [];
  readonly doors: Door[] = [];

  constructor(
    readonly id: MapId,
    readonly name: string,
    readonly width: number,
    readonly height: number,
    fill: TileKind,
    readonly indoor = false,
  ) {
    this.tiles = Array.from({ length: height }, () => Array<TileKind>(width).fill(fill));
  }

  set(x: number, y: number, kind: TileKind): this {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) throw new Error(`${this.id}: (${x}, ${y}) is off the map`);
    this.tiles[y][x] = kind;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, kind: TileKind): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, kind);
    return this;
  }

  /** Fill the outer ring of the map, leaving the given gaps open. */
  border(kind: TileKind, gaps: [number, number][] = []): this {
    const open = new Set(gaps.map(([x, y]) => `${x},${y}`));
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const edge = x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1;
        if (edge && !open.has(`${x},${y}`)) this.set(x, y, kind);
      }
    }
    return this;
  }

  /** Place a building; its door leads to `interior`. */
  building(kind: BuildingKind, x: number, y: number, interior: MapId, seed: string = interior): this {
    const size = buildingSize(kind);
    this.buildings.push({ kind, x, y, seed });
    this.doors.push({ map: this.id, x: x + size.doorTile, y: y + size.heightTiles - 1, interior });
    return this;
  }

  npc(def: NpcDef): this {
    this.npcs.push(def);
    return this;
  }

  sign(x: number, y: number, text: string): this {
    this.set(x, y, 'sign');
    this.signs.push({ x, y, text });
    return this;
  }

  warp(x: number, y: number, to: MapId, toX: number, toY: number, facing: Facing): this {
    this.warps.push({ x, y, to, toX, toY, facing });
    return this;
  }

  build(): MapData {
    return {
      id: this.id,
      name: this.name,
      width: this.width,
      height: this.height,
      indoor: this.indoor,
      tiles: this.tiles,
      buildings: this.buildings,
      npcs: this.npcs,
      signs: this.signs,
      warps: this.warps,
    };
  }
}
