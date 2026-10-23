import { Battle, type Outcome } from '../battle/Battle';
import { type Monster, heal } from '../battle/monster';
import { SPECIES, type SpeciesId } from '../data/species';
import type { Game } from '../engine/Game';
import type { Arena } from '../gen/battleArt';
import { BattleScene } from '../scenes/BattleScene';
import { OverworldScene } from '../scenes/OverworldScene';
import { StarterScene } from '../scenes/StarterScene';

export const PARTY_LIMIT = 6;

/** What the current overworld screen offers to scripts. */
export interface WorldView {
  say(lines: string[], speaker?: string): Promise<void>;
  /** Show a prompt and a list of options; resolves to the picked index, or -1 if cancelled. */
  choose(prompt: string, options: string[]): Promise<number>;
  /** Re-check which NPCs should be present after story flags change. */
  refresh(): void;
}

export interface BattleConfig {
  foe: Monster[];
  trainerName?: string;
  arena: Arena;
  /** 'retry' heals you on the spot; 'blackout' also sends you back to safety and costs coins. */
  onLose: 'retry' | 'blackout';
}

/**
 * The toolkit story scripts use: talking, choosing, battling and healing.
 * It always talks to whichever overworld screen is current, so a script
 * can carry on after a battle replaces the screen.
 */
export class ScriptHost {
  constructor(private game: Game) {}

  get state() {
    return this.game.state;
  }

  get flags() {
    return this.game.state.flags;
  }

  private get view(): WorldView {
    const view = this.game.world;
    if (!view) throw new Error('No overworld is active for this script');
    return view;
  }

  say(lines: string[], speaker?: string): Promise<void> {
    return this.view.say(lines, speaker);
  }

  choose(prompt: string, options: string[]): Promise<number> {
    return this.view.choose(prompt, options);
  }

  refresh(): void {
    this.view.refresh();
  }

  healParty(): void {
    for (const m of this.state.party) heal(m);
  }

  chooseStarter(): Promise<SpeciesId> {
    return new Promise((resolve) => {
      this.game.setScene(
        new StarterScene(this.game, (id) => {
          this.game.setScene(new OverworldScene(this.game));
          resolve(id);
        }),
      );
    });
  }

  battle(config: BattleConfig): Promise<{ outcome: Outcome; battle: Battle }> {
    const battle = new Battle({
      playerParty: this.state.party,
      foeParty: config.foe,
      inventory: this.state.inventory,
      rng: this.game.rng,
      trainerName: config.trainerName,
    });
    return new Promise((resolve) => {
      this.game.setScene(
        new BattleScene(this.game, battle, {
          arena: config.arena,
          onEnd: (outcome) => {
            if (outcome === 'lose') {
              this.healParty();
              if (config.onLose === 'blackout') this.sendToSafety();
            }
            if (outcome === 'caught' && battle.caught && this.state.party.length < PARTY_LIMIT) {
              this.state.party.push(battle.caught);
            }
            this.game.setScene(new OverworldScene(this.game));
            resolve({ outcome, battle });
          },
        }),
      );
    });
  }

  /** After losing everything: half your coins, and wake up at the last hospital or at home. */
  private sendToSafety(): void {
    const s = this.state;
    s.coins = Math.floor(s.coins / 2);
    const spot = s.flags.visitedHospital
      ? { map: 'hospital' as const, x: 5, y: 6 }
      : { map: 'playerHouse' as const, x: 4, y: 5 };
    s.map = spot.map;
    s.x = spot.x;
    s.y = spot.y;
    s.facing = 'up';
  }
}

/** Run a story script, keeping the player from walking off until it finishes. */
export async function runScript(game: Game, script: (host: ScriptHost) => Promise<void>): Promise<void> {
  game.scriptRunning = true;
  try {
    await script(new ScriptHost(game));
  } finally {
    game.scriptRunning = false;
  }
}

export function monsterName(id: SpeciesId): string {
  return SPECIES[id].name;
}
