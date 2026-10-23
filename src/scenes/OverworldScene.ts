import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { audio, type SongId } from '../audio';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../engine/Game';
import type { Action } from '../engine/Input';
import { hashString } from '../engine/rng';
import { Scene } from '../engine/Scene';
import { drawBuilding } from '../gen/buildings';
import { type Facing, type Outfit, PLAYER_OUTFIT, generateCharacter } from '../gen/characters';
import { textSprite } from '../gen/font';
import { PALETTE } from '../gen/palette';
import { TILE, type TileKind, generateTileset } from '../gen/tiles';
import { drawFrame } from '../gen/ui';
import { ChoiceMenu } from '../ui/ChoiceMenu';
import { DialogueBox } from '../ui/DialogueBox';
import { buildingTiles, isWalkable } from '../world/collision';
import { GATE_SCRIPTS, NPC_SCRIPTS, pauseMenu, rollEncounter, wildBattle } from '../world/events';
import { WORLD } from '../world/maps';
import { type WorldView, runScript } from '../world/script';
import type { MapData, MapId, NpcDef, Warp } from '../world/types';

/** Seconds to walk one tile. */
const STEP_TIME = 0.2;
const FADE_TIME = 0.22;
const BANNER_TIME = 2.2;
const WATER_FRAME_TIME = 0.45;
/** Chance per step in tall grass of meeting a wild monster. */
const ENCOUNTER_CHANCE = 0.1;

const MAP_MUSIC: Record<MapId, SongId> = {
  emberHollow: 'town',
  playerHouse: 'town',
  emberHouse: 'town',
  lab: 'town',
  hospital: 'town',
  market: 'town',
  mosswayTrail: 'route',
  basaltRidge: 'town2',
  basaltHouseWest: 'town2',
  basaltHouseEast: 'town2',
  gym: 'gym',
};
/** Seconds between autosaves while exploring (also saved on every map change and after each script). */
const AUTOSAVE_INTERVAL = 5;
/** Seconds between bump sounds while walking into a wall. */
const BUMP_INTERVAL = 0.3;

const DIRS: Record<Facing, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
const OPPOSITE: Record<Facing, Facing> = { up: 'down', down: 'up', left: 'right', right: 'left' };

interface Walker {
  sprite: Sprite;
  frames: Record<Facing, Texture[]>;
  x: number;
  y: number;
  facing: Facing;
}

interface NpcRuntime extends Walker {
  def: NpcDef;
}

// Generated once and shared by every visit to every map.
let tileset: Record<TileKind, Texture[]> | null = null;
const characterCache = new Map<Outfit, Record<Facing, Texture[]>>();
const buildingCache = new Map<string, Texture>();

function characterTextures(outfit: Outfit): Record<Facing, Texture[]> {
  let frames = characterCache.get(outfit);
  if (!frames) {
    frames = generateCharacter(outfit);
    characterCache.set(outfit, frames);
  }
  return frames;
}

/**
 * Top-down exploration: walks the player around a map, handles
 * collisions, doors and edge warps, NPC and sign dialogue, and the camera.
 */
export class OverworldScene extends Scene implements WorldView {
  private map!: MapData;
  private world = new Container();
  private entities = new Container();
  private overlay = new Graphics();
  private dialogue = new DialogueBox();
  private menu = new ChoiceMenu();
  private banner: Sprite | null = null;
  private bannerTime = 0;
  private waterSprites: Sprite[] = [];
  private lastBump = 0;
  private saveTimer = 0;
  private waterTime = 0;

  private player!: Walker;
  private npcs: NpcRuntime[] = [];
  private blocked = new Set<string>();
  private moving: { fromX: number; fromY: number; t: number } | null = null;
  private stepCount = 0;
  /** Fade state: fading out to a warp, or fading in after arriving. */
  private fade: { dir: 'out' | 'in'; t: number; warp?: Warp } | null = null;

  enter(): void {
    tileset ??= generateTileset();
    this.entities.sortableChildren = true;
    this.root.addChild(this.world);
    this.root.addChild(this.dialogue.root);
    this.root.addChild(this.menu.root);
    this.root.addChild(this.overlay);
    this.game.world = this;
    this.loadMap();
  }

  update(dt: number): void {
    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_INTERVAL) {
      this.saveTimer = 0;
      this.game.autosave();
    }
    this.animateWater(dt);
    this.updateBanner(dt);

    if (this.fade) {
      this.updateFade(dt);
      return;
    }
    if (this.menu.active) {
      this.dialogue.update(dt, this.game.input);
      this.menu.update(this.game.input);
      return;
    }
    if (this.dialogue.active) {
      this.dialogue.update(dt, this.game.input);
      return;
    }
    if (this.moving) {
      this.continueStep(dt);
      return;
    }
    if (this.game.scriptRunning) {
      this.setFrame(this.player, 0);
      return;
    }

    const input = this.game.input;
    if (input.wasPressed('confirm')) {
      this.interact();
      return;
    }
    if (input.wasPressed('menu') || input.wasPressed('cancel')) {
      void runScript(this.game, (host) => pauseMenu(host));
      return;
    }
    const dir = toFacing(input.heldDirection());
    if (!dir) {
      this.setFrame(this.player, 0);
      return;
    }
    this.tryStep(dir);
  }

  // ---- Map loading ------------------------------------------------------

  private loadMap(): void {
    const state = this.game.state;
    this.map = WORLD[state.map];
    this.blocked = buildingTiles(this.map);
    for (const child of this.world.removeChildren()) child.destroy({ children: true });
    this.entities = new Container();
    this.entities.sortableChildren = true;
    this.waterSprites = [];

    const ground = new Container();
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const kind = this.map.tiles[y][x];
        const variants = tileset![kind];
        const tile = new Sprite(variants[hashString(`${this.map.id}:${x},${y}`) % variants.length]);
        tile.position.set(x * TILE, y * TILE);
        if (kind === 'water') this.waterSprites.push(tile);
        ground.addChild(tile);
      }
    }
    this.world.addChild(ground);

    for (const b of this.map.buildings) {
      const cacheKey = `${b.kind}:${b.seed}`;
      let texture = buildingCache.get(cacheKey);
      if (!texture) {
        texture = drawBuilding(b.kind, b.seed).canvas.toTexture();
        buildingCache.set(cacheKey, texture);
      }
      const sprite = new Sprite(texture);
      sprite.position.set(b.x * TILE, b.y * TILE);
      sprite.zIndex = (b.y + texture.height / TILE) * TILE - 1;
      this.entities.addChild(sprite);
    }

    this.spawnNpcs();

    this.player = this.makeWalker(characterTextures(PLAYER_OUTFIT), state.x, state.y, state.facing);
    this.placeWalker(this.player, state.x, state.y);
    this.world.addChild(this.entities);
    this.updateCamera(state.x, state.y);

    audio.music(MAP_MUSIC[this.map.id]);
    if (!this.map.indoor) this.showBanner(this.map.name);
    this.fade = { dir: 'in', t: 0 };
    this.drawOverlay(1);
    this.game.autosave();
  }

  /** Create sprites for the NPCs whose story flags say they should be here. */
  private spawnNpcs(): void {
    const flags = this.game.state.flags;
    const present = (d: NpcDef) => (!d.shownWhen || flags[d.shownWhen]) && !(d.hiddenWhen && flags[d.hiddenWhen]);
    this.npcs = this.map.npcs.filter(present).map((def) => {
      const npc: NpcRuntime = { ...this.makeWalker(characterTextures(def.outfit), def.x, def.y, def.facing), def };
      this.placeWalker(npc, def.x, def.y);
      return npc;
    });
  }

  private makeWalker(frames: Record<Facing, Texture[]>, x: number, y: number, facing: Facing): Walker {
    const sprite = new Sprite(frames[facing][0]);
    sprite.anchor.set(0.5, 0);
    this.entities.addChild(sprite);
    return { sprite, frames, x, y, facing };
  }

  // ---- Movement ---------------------------------------------------------

  private tryStep(dir: Facing): void {
    const p = this.player;
    p.facing = dir;
    const [dx, dy] = DIRS[dir];
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (!this.canEnter(nx, ny)) {
      this.setFrame(p, 0);
      const now = performance.now() / 1000;
      if (now - this.lastBump > BUMP_INTERVAL) {
        this.lastBump = now;
        audio.sfx('bump');
      }
      return;
    }
    this.moving = { fromX: p.x, fromY: p.y, t: 0 };
    p.x = nx;
    p.y = ny;
    this.stepCount++;
  }

  private continueStep(dt: number): void {
    const m = this.moving!;
    const p = this.player;
    m.t += dt / STEP_TIME;
    if (m.t < 1) {
      this.placeWalker(p, m.fromX + (p.x - m.fromX) * m.t, m.fromY + (p.y - m.fromY) * m.t);
      this.setFrame(p, m.t < 0.5 ? 1 : 0);
      this.updateCamera(p.sprite.x / TILE - 0.5, p.sprite.y / TILE);
      return;
    }
    this.moving = null;
    this.placeWalker(p, p.x, p.y);
    this.updateCamera(p.x, p.y);
    this.syncState();
    const gate = this.map.gates.find((g) => g.x === p.x && g.y === p.y && !this.game.state.flags[g.flag]);
    if (gate) {
      void runScript(this.game, async (host) => {
        await host.say(gate.lines, gate.speaker);
        if (gate.script) await GATE_SCRIPTS[gate.script](host);
        if (this.game.state.flags[gate.flag] || this.game.world !== this) return;
        // Step back the way you came.
        p.x = m.fromX;
        p.y = m.fromY;
        p.facing = OPPOSITE[p.facing];
        this.placeWalker(p, p.x, p.y);
        this.setFrame(p, 0);
        this.updateCamera(p.x, p.y);
        this.syncState();
      });
      return;
    }
    const warp = this.map.warps.find((w) => w.x === p.x && w.y === p.y);
    if (warp) {
      if (this.map.indoor || WORLD[warp.to].indoor) audio.sfx('door');
      this.fade = { dir: 'out', t: 0, warp };
      return;
    }
    this.maybeEncounter();
  }

  private maybeEncounter(): void {
    const s = this.game.state;
    const p = this.player;
    if (this.map.tiles[p.y][p.x] !== 'tallGrass' || this.map.encounters.length === 0) return;
    if (!s.party.some((m) => m.hp > 0) || !this.game.rng.chance(ENCOUNTER_CHANCE)) return;
    const { species, level } = rollEncounter(this.map.encounters, this.game.rng);
    void runScript(this.game, (host) => wildBattle(host, species, level));
  }

  private canEnter(x: number, y: number): boolean {
    if (!isWalkable(this.map, x, y, this.blocked)) return false;
    return !this.npcs.some((n) => n.x === x && n.y === y);
  }

  private placeWalker(w: Walker, tx: number, ty: number): void {
    w.sprite.position.set(Math.round(tx * TILE + TILE / 2), Math.round(ty * TILE));
    w.sprite.zIndex = ty * TILE + TILE;
  }

  /** Pick a walk frame; mirror alternate steps on up/down so both legs move. */
  private setFrame(w: Walker, frame: number): void {
    w.sprite.texture = w.frames[w.facing][frame];
    const vertical = w.facing === 'up' || w.facing === 'down';
    w.sprite.scale.x = vertical && frame === 1 && this.stepCount % 2 === 0 ? -1 : 1;
  }

  private syncState(): void {
    const s = this.game.state;
    s.map = this.map.id;
    s.x = this.player.x;
    s.y = this.player.y;
    s.facing = this.player.facing;
  }

  // ---- Interaction ------------------------------------------------------

  private interact(): void {
    const p = this.player;
    const [dx, dy] = DIRS[p.facing];
    let tx = p.x + dx;
    let ty = p.y + dy;
    // Talk across counters and tables to whoever stands behind them.
    const between = this.map.tiles[ty]?.[tx];
    if (between === 'counter' || between === 'table') {
      tx += dx;
      ty += dy;
    }
    const npc = this.npcs.find((n) => n.x === tx && n.y === ty);
    if (npc) {
      npc.facing = OPPOSITE[p.facing];
      this.setFrame(npc, 0);
      const script = NPC_SCRIPTS[npc.def.id];
      if (script) {
        void runScript(this.game, (host) => script(host, npc.def));
        return;
      }
      this.dialogue.show(npc.def.lines, npc.def.name, () => {
        npc.facing = npc.def.facing;
        this.setFrame(npc, 0);
      });
      return;
    }
    const sign = this.map.signs.find((s) => s.x === p.x + dx && s.y === p.y + dy);
    if (sign) this.dialogue.show([sign.text]);
  }

  // ---- WorldView: what story scripts can do -----------------------------

  say(lines: string[], speaker?: string): Promise<void> {
    return new Promise((resolve) => this.dialogue.show(lines, speaker, resolve));
  }

  choose(prompt: string, options: string[]): Promise<number> {
    return new Promise((resolve) => {
      this.dialogue.show([prompt], undefined, () => {
        const menuH = options.length * 12 + 12;
        const w = Math.max(...options.map((o) => o.length)) * 6 + 28;
        this.menu.open(
          options.map((label, i) => ({
            label,
            onPick: () => {
              this.dialogue.hide();
              resolve(i);
            },
          })),
          VIEW_WIDTH - w - 4,
          VIEW_HEIGHT - 50 - menuH,
          () => {
            this.dialogue.hide();
            resolve(-1);
          },
        );
      }, { hold: true });
    });
  }

  refresh(): void {
    for (const npc of this.npcs) npc.sprite.destroy();
    this.spawnNpcs();
  }

  // ---- Transitions, camera and effects ----------------------------------

  private updateFade(dt: number): void {
    const f = this.fade!;
    f.t += dt / FADE_TIME;
    if (f.dir === 'out') {
      this.drawOverlay(Math.min(1, f.t));
      if (f.t >= 1 && f.warp) {
        const s = this.game.state;
        s.map = f.warp.to;
        s.x = f.warp.toX;
        s.y = f.warp.toY;
        s.facing = f.warp.facing;
        this.loadMap();
      }
    } else {
      this.drawOverlay(Math.max(0, 1 - f.t));
      if (f.t >= 1) this.fade = null;
    }
  }

  private drawOverlay(alpha: number): void {
    this.overlay.clear();
    if (alpha > 0) this.overlay.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT).fill({ color: 0x000000, alpha });
  }

  /** Centre the camera on a tile position, clamped to the map (or centred if the map is small). */
  private updateCamera(tx: number, ty: number): void {
    const mapW = this.map.width * TILE;
    const mapH = this.map.height * TILE;
    const axis = (center: number, size: number, view: number) =>
      size <= view ? -Math.floor((view - size) / 2) : Math.max(0, Math.min(size - view, center - view / 2));
    const camX = axis(tx * TILE + TILE / 2, mapW, VIEW_WIDTH);
    const camY = axis(ty * TILE + TILE / 2, mapH, VIEW_HEIGHT);
    this.world.position.set(-Math.round(camX), -Math.round(camY));
  }

  private animateWater(dt: number): void {
    if (this.waterSprites.length === 0) return;
    const before = Math.floor(this.waterTime / WATER_FRAME_TIME);
    this.waterTime += dt;
    const frame = Math.floor(this.waterTime / WATER_FRAME_TIME);
    if (frame === before) return;
    const frames = tileset!.water;
    for (const s of this.waterSprites) s.texture = frames[frame % frames.length];
  }

  private showBanner(name: string): void {
    this.banner?.destroy({ children: true, texture: true, textureSource: true });
    const label = textSprite(name, { color: PALETTE.ink });
    const frame = new Sprite(drawFrame(label.width + 16, 17).toTexture());
    label.position.set(8, 5);
    frame.addChild(label);
    frame.position.set(4, 4);
    this.banner = frame;
    this.bannerTime = BANNER_TIME;
    this.root.addChildAt(frame, this.root.getChildIndex(this.overlay));
  }

  private updateBanner(dt: number): void {
    if (!this.banner) return;
    this.bannerTime -= dt;
    this.banner.alpha = Math.min(1, this.bannerTime * 3);
    if (this.bannerTime <= 0) {
      this.banner.destroy({ children: true, texture: true, textureSource: true });
      this.banner = null;
    }
  }

  exit(): void {
    this.banner = null;
    if (this.game.world === this) this.game.world = null;
  }
}

function toFacing(action: Action | null): Facing | null {
  return action === 'up' || action === 'down' || action === 'left' || action === 'right' ? action : null;
}

