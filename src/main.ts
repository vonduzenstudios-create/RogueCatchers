import { Game } from './engine/Game';
import { TitleScene } from './scenes/TitleScene';

const host = document.getElementById('game');
if (!host) throw new Error('Missing #game element');

const game = new Game();
void game.start(host, (g) => new TitleScene(g));
