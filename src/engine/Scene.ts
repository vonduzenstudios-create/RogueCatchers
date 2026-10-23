import { Container } from 'pixi.js';
import type { Game } from './Game';

/** A self-contained screen of the game: title, overworld, battle and so on. */
export abstract class Scene {
  readonly root = new Container();

  constructor(protected readonly game: Game) {}

  /** Called once when the scene becomes active. */
  enter(): void {}

  /** Called every frame with the elapsed time in seconds. */
  abstract update(dt: number): void;

  /** Called when the scene is replaced; free textures here. */
  exit(): void {}
}
