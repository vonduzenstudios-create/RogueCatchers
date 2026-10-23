import { describe, expect, it } from 'vitest';
import { buildingTiles, isWalkable, key } from '../src/world/collision';
import { START, WORLD } from '../src/world/maps';
import type { MapData, MapId } from '../src/world/types';

const maps = Object.values(WORLD);

/** Tiles reachable on foot from (x, y) within one map, treating NPCs as walls. */
function reachable(map: MapData, x: number, y: number): Set<string> {
  const blocked = buildingTiles(map);
  const npcs = new Set(map.npcs.map((n) => key(n.x, n.y)));
  const seen = new Set([key(x, y)]);
  const queue: [number, number][] = [[x, y]];
  while (queue.length) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = key(nx, ny);
      if (seen.has(k) || npcs.has(k) || !isWalkable(map, nx, ny, blocked)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

describe('world maps', () => {
  it.each(maps.map((m) => [m.id, m] as const))('%s has a consistent grid', (_, map) => {
    expect(map.tiles).toHaveLength(map.height);
    for (const row of map.tiles) expect(row).toHaveLength(map.width);
  });

  it.each(maps.map((m) => [m.id, m] as const))('%s places NPCs on open ground', (_, map) => {
    for (const npc of map.npcs) expect(isWalkable(map, npc.x, npc.y), `${npc.id}`).toBe(true);
  });

  it('sends every warp to an open tile', () => {
    for (const map of maps) {
      for (const w of map.warps) {
        const target = WORLD[w.to];
        expect(isWalkable(map, w.x, w.y), `${map.id} warp at ${w.x},${w.y}`).toBe(true);
        expect(isWalkable(target, w.toX, w.toY), `${map.id} -> ${w.to} at ${w.toX},${w.toY}`).toBe(true);
        expect(target.warps.some((back) => back.x === w.toX && back.y === w.toY), 'arriving on a warp would loop').toBe(false);
      }
    }
  });

  it('lets the player reach every map and every warp on foot from the start', () => {
    const visited = new Set<MapId>();
    const queue: [MapId, number, number][] = [[START.map, START.x, START.y]];
    while (queue.length) {
      const [id, x, y] = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const map = WORLD[id];
      const area = reachable(map, x, y);
      for (const w of map.warps) {
        // A warp tile counts as reachable if you can step onto it from a reachable neighbour.
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => area.has(key(w.x + dx, w.y + dy)));
        expect(near || area.has(key(w.x, w.y)), `${id} warp at ${w.x},${w.y} is unreachable`).toBe(true);
        queue.push([w.to, w.toX, w.toY]);
      }
    }
    expect([...visited].sort()).toEqual(Object.keys(WORLD).sort());
  });
});
