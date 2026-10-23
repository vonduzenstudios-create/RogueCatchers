import { audio } from './audio';
import { Battle } from './battle/Battle';
import { createMonster } from './battle/monster';
import type { SpeciesId } from './data/species';
import { Game } from './engine/Game';
import { Rng } from './engine/rng';
import { BattleScene } from './scenes/BattleScene';
import { OverworldScene } from './scenes/OverworldScene';
import { TitleScene } from './scenes/TitleScene';

const host = document.getElementById('game');
if (!host) throw new Error('Missing #game element');

const game = new Game();
audio.attach();
void game.start(host, (g) => new TitleScene(g));

// Handy for debugging and automated play-tests in development builds.
if (import.meta.env.DEV) {
  Object.assign(window, {
    game,
    audio,
    /** Start a battle from the browser console, e.g. testBattle('splashell', 'zapkit'). */
    testBattle(mine: SpeciesId = 'splashell', foe: SpeciesId = 'zapkit', trainerName?: string) {
      const s = game.state;
      if (s.party.length === 0) s.party.push(createMonster(mine, 8));
      s.inventory.potion = Math.max(s.inventory.potion, 3);
      s.inventory.catchOrb = Math.max(s.inventory.catchOrb, 5);
      const battle = new Battle({
        playerParty: s.party,
        foeParty: [createMonster(foe, 6)],
        inventory: s.inventory,
        rng: new Rng(Date.now()),
        trainerName,
      });
      game.setScene(
        new BattleScene(game, battle, {
          arena: 'grass',
          onEnd: () => game.setScene(new OverworldScene(game)),
        }),
      );
    },
  });
}
