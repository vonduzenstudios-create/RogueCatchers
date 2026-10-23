import { Container, Sprite, Texture } from 'pixi.js';
import { Scene } from '../engine/Scene';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../engine/Game';
import type { Action } from '../engine/Input';
import { Rng } from '../engine/rng';
import { type Facing, PLAYER_OUTFIT, generateCharacter } from '../gen/characters';
import { textSprite } from '../gen/font';
import { PALETTE } from '../gen/palette';
import { SOLID, TILE, type TileKind, generateTileset } from '../gen/tiles';
import { TitleScene } from './TitleScene';

const MAP_W = 32;
const MAP_H = 22;
/** Seconds to walk one tile. */
const STEP_TIME = 0.22;

const DIRS: Record<Facing, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * Milestone 1 playground: a generated field to walk around in, proving
 * the loop, input, camera, seeded generation and scene switching.
 */
export class SandboxScene extends Scene {
  private map: TileKind[][] = [];
  private world = new Container();
  private player!: Sprite;
  private frames!: Record<Facing, Texture[]>;
  private facing: Facing = 'down';
  private tileX = Math.floor(MAP_W / 2);
  private tileY = Math.floor(MAP_H / 2);
  private moving: { fromX: number; fromY: number; t: number } | null = null;
  private stepCount = 0;

  enter(): void {
    const rng = new Rng('sandbox');
    this.map = buildMap(rng);
    const tiles = generateTileset();

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const kind = this.map[y][x];
        const tile = new Sprite(rng.pick(tiles[kind]));
        tile.position.set(x * TILE, y * TILE);
        this.world.addChild(tile);
      }
    }

    this.frames = generateCharacter(PLAYER_OUTFIT);
    this.player = new Sprite(this.frames.down[0]);
    this.player.anchor.set(0.5, 0);
    this.world.addChild(this.player);
    this.root.addChild(this.world);

    const hud = textSprite('Arrows or WASD to walk - Esc for title', { color: PALETTE.white, outline: PALETTE.ink });
    hud.position.set(4, 4);
    this.root.addChild(hud);

    this.placePlayer(this.tileX, this.tileY);
  }

  update(dt: number): void {
    const input = this.game.input;
    if (input.wasPressed('cancel')) {
      this.game.setScene(new TitleScene(this.game));
      return;
    }

    if (this.moving) {
      this.moving.t += dt / STEP_TIME;
      if (this.moving.t >= 1) {
        this.moving = null;
        this.placePlayer(this.tileX, this.tileY);
      } else {
        const { fromX, fromY, t } = this.moving;
        this.placePlayer(fromX + (this.tileX - fromX) * t, fromY + (this.tileY - fromY) * t);
        this.setFrame(t < 0.5 ? 1 : 0);
        return;
      }
    }

    const dir = toFacing(input.heldDirection());
    if (!dir) {
      this.setFrame(0);
      return;
    }
    this.facing = dir;
    const [dx, dy] = DIRS[dir];
    const nx = this.tileX + dx;
    const ny = this.tileY + dy;
    if (this.walkable(nx, ny)) {
      this.moving = { fromX: this.tileX, fromY: this.tileY, t: 0 };
      this.tileX = nx;
      this.tileY = ny;
      this.stepCount++;
    } else {
      this.setFrame(0);
    }
  }

  private walkable(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !SOLID.has(this.map[y][x]);
  }

  /** Choose a walk frame; mirror alternate steps on up/down so both legs move. */
  private setFrame(frame: number): void {
    this.player.texture = this.frames[this.facing][frame];
    const vertical = this.facing === 'up' || this.facing === 'down';
    this.player.scale.x = vertical && frame === 1 && this.stepCount % 2 === 0 ? -1 : 1;
  }

  /** Position the player in tile units and keep the camera centred, clamped to the map. */
  private placePlayer(tx: number, ty: number): void {
    const px = tx * TILE + TILE / 2;
    const py = ty * TILE;
    this.player.position.set(Math.round(px), Math.round(py));
    const camX = clamp(px - VIEW_WIDTH / 2, 0, MAP_W * TILE - VIEW_WIDTH);
    const camY = clamp(py + TILE / 2 - VIEW_HEIGHT / 2, 0, MAP_H * TILE - VIEW_HEIGHT);
    this.world.position.set(-Math.round(camX), -Math.round(camY));
  }
}

function buildMap(rng: Rng): TileKind[][] {
  const map: TileKind[][] = Array.from({ length: MAP_H }, () => Array<TileKind>(MAP_W).fill('grass'));
  const cx = Math.floor(MAP_W / 2);
  const cy = Math.floor(MAP_H / 2);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const border = x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1;
      if (border) map[y][x] = 'tree';
      else if (rng.chance(0.08)) map[y][x] = 'flowers';
    }
  }

  // Crossroads paths through the middle.
  for (let x = 1; x < MAP_W - 1; x++) map[cy][x] = 'path';
  for (let y = 1; y < MAP_H - 1; y++) map[y][cx] = 'path';

  // Tall grass patches and tree clumps away from the paths.
  const patch = (kind: TileKind, count: number, size: number) => {
    for (let i = 0; i < count; i++) {
      const px = rng.int(2, MAP_W - 3);
      const py = rng.int(2, MAP_H - 3);
      for (let j = 0; j < size; j++) {
        const x = px + rng.int(-2, 2);
        const y = py + rng.int(-1, 1);
        if (x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1 && x !== cx && y !== cy) map[y][x] = kind;
      }
    }
  };
  patch('tallGrass', 6, 14);
  patch('tree', 5, 4);
  return map;
}

function toFacing(action: Action | null): Facing | null {
  return action === 'up' || action === 'down' || action === 'left' || action === 'right' ? action : null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
