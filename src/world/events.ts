import { POTION_HEAL } from '../battle/Battle';
import { createMonster, statsOf } from '../battle/monster';
import { MOVES } from '../data/moves';
import { SPECIES } from '../data/species';
import type { SpeciesId } from '../data/species';
import { type ScriptHost, PARTY_LIMIT, monsterName } from './script';
import type { EncounterSlot, NpcDef } from './types';
import type { Rng } from '../engine/rng';

/*
 * Story scripts. NPCs listed here run a script when you talk to them
 * instead of just saying their lines.
 */

/**
 * Kael grabs the starter he thinks looks coolest, which happens to be
 * weak to yours, so the first battle is a fair test. He comes back
 * stronger later.
 */
export const RIVAL_COUNTER: Record<string, SpeciesId> = {
  embrit: 'sproutle',
  splashell: 'embrit',
  sproutle: 'splashell',
};

export const PRICES = { catchOrb: 20, potion: 30 } as const;
export const RIVAL_LAB_REWARD = 100;

export function playerStarter(host: ScriptHost): SpeciesId | null {
  const id = Object.keys(RIVAL_COUNTER).find((s) => host.flags[`starter_${s}`]);
  return (id as SpeciesId) ?? null;
}

async function rivalLabBattle(host: ScriptHost): Promise<void> {
  const mine = playerStarter(host)!;
  const theirs = RIVAL_COUNTER[mine];
  const { outcome } = await host.battle({
    foe: [createMonster(theirs, 5)],
    trainerName: 'Rival Kael',
    arena: 'indoor',
    onLose: 'retry',
  });
  if (outcome === 'win') {
    host.flags.beatRivalLab = true;
    host.state.coins += RIVAL_LAB_REWARD;
    await host.say(['What? I lost?!', "Fine. I'll train on Mossway Trail. Next time I'll crush you!"], 'Kael');
    host.refresh();
    await host.say(['Splendid battle! Take these for your journey.'], 'Prof. Alder');
    host.state.inventory.catchOrb += 5;
    host.state.inventory.potion += 2;
    await host.say([`You received 5 Catch Orbs and 2 Potions!`, `You earned ${RIVAL_LAB_REWARD} coins for winning!`]);
    await host.say(
      [
        'Weaken a wild monster in battle, then throw a Catch Orb to catch it.',
        'Mossway Trail is north of town, and Basalt Ridge lies beyond it. Good luck!',
      ],
      'Prof. Alder',
    );
  } else {
    await host.say(['Ha! Too easy!'], 'Kael');
    await host.say(["Don't worry, I've healed your monster. Talk to Kael for a rematch!"], 'Prof. Alder');
  }
}

export const NPC_SCRIPTS: Record<string, (host: ScriptHost, npc: NpcDef) => Promise<void>> = {
  async professor(host, npc) {
    const f = host.flags;
    if (!f.gotStarter) {
      await host.say(npc.lines, npc.name);
      const pick = await host.chooseStarter();
      host.state.party.push(createMonster(pick, 5));
      f.gotStarter = true;
      f[`starter_${pick}`] = true;
      await host.say([`So you chose ${monsterName(pick)}! Take good care of it.`], npc.name);
      const theirs = RIVAL_COUNTER[pick];
      await host.say([`Then I'll take ${monsterName(theirs)}! It looks way cooler.`, "Come on, let's battle!"], 'Kael');
      await rivalLabBattle(host);
    } else if (!f.beatRivalLab) {
      await host.say(["Kael wants a rematch. Talk to him when you're ready!"], npc.name);
    } else {
      await host.say(
        ['Head north through Mossway Trail to reach Basalt Ridge.', 'The Market there sells more Catch Orbs.'],
        npc.name,
      );
    }
  },

  async rival(host, npc) {
    if (!host.flags.gotStarter) return host.say(npc.lines, npc.name);
    await host.say(['Ready for a rematch? This time I win!'], npc.name);
    await rivalLabBattle(host);
  },

  async nurse(host, npc) {
    host.flags.visitedHospital = true;
    if (host.state.party.length === 0) return host.say(npc.lines, npc.name);
    await host.say(['Welcome to the Monster Hospital!', "Let me heal your monsters. Just a moment..."], npc.name);
    host.healParty();
    await host.say(['Your monsters are fully healed! Come back anytime.'], npc.name);
  },

  async mom(host, npc) {
    if (host.state.party.length === 0) return host.say(npc.lines, npc.name);
    host.healParty();
    await host.say(['You look tired! Have a rest.', 'Your monsters are fully healed.'], npc.name);
  },

  async clerk(host, npc) {
    const inv = host.state.inventory;
    await host.say(['Welcome to the Market!'], npc.name);
    for (;;) {
      const choice = await host.choose(`You have ${host.state.coins} coins. What would you like?`, [
        `Catch Orb ${PRICES.catchOrb}c`,
        `Potion ${PRICES.potion}c`,
        'Leave',
      ]);
      if (choice === 0 || choice === 1) {
        const item = choice === 0 ? 'catchOrb' : 'potion';
        const price = PRICES[item];
        if (host.state.coins < price) {
          await host.say(["Sorry, you don't have enough coins.", 'Win battles to earn more!'], npc.name);
          continue;
        }
        host.state.coins -= price;
        inv[item]++;
        await host.say([`Here you go! You now have ${inv[item]} ${item === 'catchOrb' ? 'Catch Orbs' : 'Potions'}.`], npc.name);
        continue;
      }
      await host.say(['Thanks for stopping by!'], npc.name);
      return;
    }
  },
};

/** Pick a wild monster from a map's encounter table. */
export function rollEncounter(table: EncounterSlot[], rng: Rng): { species: SpeciesId; level: number } {
  const total = table.reduce((n, s) => n + s.weight, 0);
  let roll = rng.next() * total;
  for (const slot of table) {
    roll -= slot.weight;
    if (roll < 0) return { species: slot.species, level: rng.int(slot.minLevel, slot.maxLevel) };
  }
  const last = table.at(-1)!;
  return { species: last.species, level: last.minLevel };
}

export async function wildBattle(host: ScriptHost, species: SpeciesId, level: number): Promise<void> {
  const fullBefore = host.state.party.length >= PARTY_LIMIT;
  const { outcome, battle } = await host.battle({ foe: [createMonster(species, level)], arena: 'grass', onLose: 'blackout' });
  if (outcome === 'caught' && battle.caught) {
    const name = monsterName(battle.caught.species);
    await host.say([fullBefore ? `Your party is full, so ${name} was set free.` : `${name} joined your party!`]);
  } else if (outcome === 'lose') {
    await host.say(['You hurried back to safety and your monsters were healed.', 'You dropped half your coins in the rush...']);
  }
}

/** The pause menu: look at your party, use Potions, pick who leads. */
export async function pauseMenu(host: ScriptHost): Promise<void> {
  const s = host.state;
  for (;;) {
    const pick = await host.choose(`Coins: ${s.coins}   Catch Orbs: ${s.inventory.catchOrb}   Potions: ${s.inventory.potion}`, [
      'Party',
      'Close',
    ]);
    if (pick !== 0) return;
    if (s.party.length === 0) {
      await host.say(["You don't have any monsters yet."]);
      continue;
    }
    await partyMenu(host);
  }
}

async function partyMenu(host: ScriptHost): Promise<void> {
  const s = host.state;
  for (;;) {
    const labels = s.party.map((m) => `${SPECIES[m.species].name} Lv${m.level} ${m.hp}/${statsOf(m).maxHp}`);
    const i = await host.choose('Which monster?', [...labels, 'Back']);
    if (i < 0 || i >= s.party.length) return;
    const m = s.party[i];
    const sp = SPECIES[m.species];
    const status = m.status ? ` Status: ${m.status}.` : '';
    await host.say([`${sp.name}, ${sp.type} type. Moves: ${m.moves.map((id) => MOVES[id].name).join(', ')}.${status}`]);
    const action = await host.choose(`What should ${sp.name} do?`, ['Use Potion', 'Lead the party', 'Back']);
    if (action === 0) {
      const max = statsOf(m).maxHp;
      if (s.inventory.potion <= 0) await host.say(['You have no Potions.']);
      else if (m.hp >= max) await host.say([`${sp.name} is already at full health.`]);
      else if (m.hp <= 0) await host.say([`${sp.name} has fainted. Take it to the Monster Hospital!`]);
      else {
        s.inventory.potion--;
        m.hp = Math.min(max, m.hp + POTION_HEAL);
        await host.say([`${sp.name} recovered some HP!`]);
      }
    } else if (action === 1 && i > 0) {
      s.party.splice(i, 1);
      s.party.unshift(m);
      await host.say([`${sp.name} will lead the next battle.`]);
    }
  }
}
