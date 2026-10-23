import { Application, TextureStyle } from 'pixi.js';
import { type GameState, newGameState } from '../state/GameState';
import { Input } from './Input';
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

    this.setScene(first(this));
    this.app.ticker.add((ticker) => {
      const dt = Math.min(ticker.deltaMS / 1000, MAX_DT);
      this.scene?.update(dt);
      this.input.endFrame();
    });
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
