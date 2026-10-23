import { Game } from './engine/Game';
import { TitleScene } from './scenes/TitleScene';

const host = document.getElementById('game');
if (!host) throw new Error('Missing #game element');

const game = new Game();
void game.start(host, (g) => new TitleScene(g));

// Handy for debugging and automated play-tests in development builds.
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
