import { buildingSize } from '../gen/buildings';
import { SOLID } from '../gen/tiles';
import type { MapData } from './types';

/** Tiles covered by buildings, except each building's door. */
export function buildingTiles(map: MapData): Set<string> {
  const blocked = new Set<string>();
  for (const b of map.buildings) {
    const size = buildingSize(b.kind);
    for (let y = b.y; y < b.y + size.heightTiles; y++) {
      for (let x = b.x; x < b.x + size.widthTiles; x++) {
        const isDoor = x === b.x + size.doorTile && y === b.y + size.heightTiles - 1;
        if (!isDoor) blocked.add(key(x, y));
      }
    }
  }
  return blocked;
}

/** Can something stand on (x, y), ignoring characters? */
export function isWalkable(map: MapData, x: number, y: number, buildings = buildingTiles(map)): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return !SOLID.has(map.tiles[y][x]) && !buildings.has(key(x, y));
}

export function key(x: number, y: number): string {
  return `${x},${y}`;
}
