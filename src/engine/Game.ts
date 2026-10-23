import { Application, TextureStyle } from 'pixi.js';
import { type GameState, newGameState } from '../state/GameState';
import { saveGame } from '../state/save';
import type { WorldView } from '../world/script';
import { Input } from './Input';
import { Rng } from './rng';
import type { Scene } from './Scene';

/** Internal resolution in game pixels; the canvas is scaled up by whole numbers. */
export const VIEW_WIDTH = 320;
export const VIEW_HEIGHT = 180;

/** Longest frame step we simulate, so a background tab doesn't teleport the player. */
const MAX_DT = 1 / 20;

export class Game {
  readonly app = new Application();
  readonly input = new Input();
  state: GameState = newGameState();
  /** Random numbers for encounters and battles; varies every session. */
  rng = new Rng(Date.now());
  /** True while a story script is running, so the overworld ignores walking input. */
  scriptRunning = false;
  /** The overworld screen currently showing, if any. Story scripts talk to it. */
  world: WorldView | null = null;
  private scene: Scene | null = null;

  async start(host: HTMLElement, first: (game: Game) => Scene): Promise<void> {
    TextureStyle.defaultOptions.scaleMode = 'nearest';
    await this.app.init({
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      background: '#0b0d17',
      antialias: false,
      resolution: 1,
      roundPixels: true,
    });
    host.appendChild(this.app.canvas);
    this.fitToWindow();
    window.addEventListener('resize', () => this.fitToWindow());
    window.addEventListener('pagehide', () => this.autosave());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.autosave();
    });

    this.setScene(first(this));
    this.app.ticker.add((ticker) => {
      const dt = Math.min(ticker.deltaMS / 1000, MAX_DT);
      this.state.stats.playSeconds += dt;
      this.scene?.update(dt);
      this.input.endFrame();
    });
  }

  /**
   * Save to the browser, but only from the overworld between scripts,
   * so a save never lands halfway through a battle or a story beat.
   */
  autosave(): void {
    if (this.world && !this.scriptRunning) saveGame(this.state);
  }

  setScene(next: Scene): void {
    if (this.scene) {
      this.scene.exit();
      this.app.stage.removeChild(this.scene.root);
      this.scene.root.destroy({ children: true });
    }
    this.scene = next;
    this.app.stage.addChild(next.root);
    next.enter();
  }

  /** Scale the canvas by the largest whole number that fits, keeping pixels square. */
  private fitToWindow(): void {
    const scale = Math.max(
      1,
      Math.floor(Math.min(window.innerWidth / VIEW_WIDTH, window.innerHeight / VIEW_HEIGHT)),
    );
    const canvas = this.app.canvas;
    canvas.style.width = `${VIEW_WIDTH * scale}px`;
    canvas.style.height = `${VIEW_HEIGHT * scale}px`;
  }
}
