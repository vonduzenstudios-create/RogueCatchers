import { POTION_HEAL } from '../battle/Battle';
import { createMonster, gainXp, statsOf, xpForLevel } from '../battle/monster';
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

// ---- Rewards ---------------------------------------------------------------

interface Reward {
  label: string;
  give: (host: ScriptHost) => string;
}

const REWARDS: Reward[] = [
  { label: '3 Catch Orbs', give: (h) => ((h.state.inventory.catchOrb += 3), 'You got 3 Catch Orbs!') },
  { label: '2 Potions', give: (h) => ((h.state.inventory.potion += 2), 'You got 2 Potions!') },
  { label: '60 coins', give: (h) => ((h.state.coins += 60), 'You got 60 coins!') },
  {
    label: 'Training Snack',
    give: (h) => {
      const lead = h.state.party[0];
      gainXp(lead, xpForLevel(lead.level + 1) - lead.xp);
      return `${monsterName(lead.species)} ate the snack and grew to level ${lead.level}!`;
    },
  },
  { label: 'Full heal', give: (h) => (h.healParty(), 'Your monsters were fully healed!') },
];

/** The roguelike touch: after a big win, choose one of three random rewards. */
export async function rewardPick(host: ScriptHost, rng: Rng): Promise<void> {
  const pool = [...REWARDS];
  const offer: Reward[] = [];
  while (offer.length < 3) offer.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  let pick = -1;
  while (pick < 0) pick = await host.choose('Choose a reward!', offer.map((r) => r.label));
  await host.say([offer[pick].give(host)]);
}

// ---- Trainer battles ---------------------------------------------------------

type Team = [SpeciesId, number][];

/** Every trainer's team, in one place so the difficulty curve can be tested. */
export const TRAINER_TEAMS = {
  wren: [
    ['brambun', 5],
    ['zapkit', 6],
  ] as Team,
  moss: [
    ['pebblet', 7],
    ['puddlop', 7],
  ] as Team,
  rivalRoute: (theirs: SpeciesId): Team => [
    ['zapkit', 7],
    [theirs, 9],
  ],
  flint: [
    ['pebblet', 8],
    ['pebblet', 9],
  ] as Team,
  basalt: [
    ['pebblet', 10],
    ['cragmaw', 11],
  ] as Team,
};

interface TrainerBattle {
  flag: string;
  trainerName: string;
  team: Team;
  coins: number;
  before: string[];
  afterWin: string[];
  /** What they say once beaten. */
  beaten: string[];
  arena: 'grass' | 'indoor' | 'gym';
  reward?: boolean;
}

/** Talk to a trainer: battle once, then they just chat. */
async function trainer(host: ScriptHost, speaker: string, t: TrainerBattle, rng: Rng): Promise<boolean> {
  if (host.flags[t.flag]) {
    await host.say(t.beaten, speaker);
    return true;
  }
  if (!host.state.party.some((m) => m.hp > 0)) {
    await host.say(['Your monsters are too tired to battle. Heal them first!']);
    return false;
  }
  await host.say(t.before, speaker);
  const { outcome } = await host.battle({
    foe: t.team.map(([species, level]) => createMonster(species, level)),
    trainerName: t.trainerName,
    arena: t.arena,
    onLose: 'blackout',
  });
  if (outcome !== 'win') {
    await host.say(['You hurried back to safety and your monsters were healed.', 'You dropped half your coins in the rush...']);
    return false;
  }
  host.flags[t.flag] = true;
  host.state.coins += t.coins;
  await host.say(t.afterWin, speaker);
  await host.say([`You earned ${t.coins} coins!`]);
  if (t.reward) await rewardPick(host, rng);
  host.refresh();
  return true;
}

async function rivalRoute(host: ScriptHost): Promise<void> {
  const theirs = RIVAL_COUNTER[playerStarter(host) ?? 'embrit'];
  await trainer(
    host,
    'Kael',
    {
      flag: 'beatRivalRoute',
      trainerName: 'Rival Kael',
      team: TRAINER_TEAMS.rivalRoute(theirs),
      coins: 200,
      before: ["I've been training on this trail all day.", "I even caught a Zapkit! Let's go!"],
      afterWin: ['No way... beaten again?!', "Basalt Ridge's gym leader is tough. Don't embarrass yourself!"],
      beaten: [],
      arena: 'grass',
      reward: true,
    },
    host.rng,
  );
}

export const GATE_SCRIPTS: Record<string, (host: ScriptHost) => Promise<void>> = {
  rivalRoute,
};

export const NPC_SCRIPTS: Record<string, (host: ScriptHost, npc: NpcDef) => Promise<void>> = {
  'rival-route': async (host) => {
    await rivalRoute(host);
  },

  'trainer-wren': async (host, npc) => {
    if (!host.flags.gotStarter) return host.say(npc.lines, npc.name);
    await trainer(
      host,
      npc.name,
      {
        flag: 'beatWren',
        trainerName: 'Bug Catcher Wren',
        team: TRAINER_TEAMS.wren,
        coins: 80,
        before: ['You look new around here. Show me what you caught!'],
        afterWin: ['Wow, your team is strong!'],
        beaten: ['I need to catch more monsters before we battle again.'],
        arena: 'grass',
      },
      host.rng,
    );
  },

  'trainer-moss': async (host, npc) => {
    if (!host.flags.gotStarter) return host.say(npc.lines, npc.name);
    await trainer(
      host,
      npc.name,
      {
        flag: 'beatMoss',
        trainerName: 'Hiker Moss',
        team: TRAINER_TEAMS.moss,
        coins: 100,
        before: ["Hiking builds strength! Let's see if battling does too!"],
        afterWin: ['Ha! You crushed me like a pebble.'],
        beaten: ['Basalt Ridge is just north. Its gym leader uses Stone types!', 'Bring Water or Grass moves.'],
        arena: 'grass',
      },
      host.rng,
    );
  },

  'gym-trainer': async (host, npc) => {
    await trainer(
      host,
      npc.name,
      {
        flag: 'beatFlint',
        trainerName: 'Climber Flint',
        team: TRAINER_TEAMS.flint,
        coins: 150,
        before: ['You want to see Leader Basalt? Get past me first!'],
        afterWin: ['You made it past me. Leader Basalt is waiting.'],
        beaten: ["Leader Basalt's Cragmaw is the toughest rock around."],
        arena: 'gym',
        reward: true,
      },
      host.rng,
    );
  },

  'leader-basalt': async (host, npc) => {
    if (host.flags.badge) {
      await host.say(['You earned that badge fair and square.', 'Keep training, and come back for a rematch someday!'], npc.name);
      return;
    }
    if (!host.flags.beatFlint) {
      await host.say(["I'm Basalt, leader of this gym.", 'Beat my student Flint first, then we can talk.'], npc.name);
      return;
    }
    const won = await trainer(
      host,
      npc.name,
      {
        flag: 'badge',
        trainerName: 'Leader Basalt',
        team: TRAINER_TEAMS.basalt,
        coins: 500,
        before: ["I'm Basalt, leader of this gym.", 'My Stone monsters are as solid as the ridge itself. Show me your strength!'],
        afterWin: ['Incredible! You broke through my defense.', 'You have earned the Basalt Badge!'],
        beaten: [],
        arena: 'gym',
      },
      host.rng,
    );
    if (won) await host.showEnding();
  },

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
