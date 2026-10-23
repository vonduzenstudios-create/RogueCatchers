import { describe, expect, it } from 'vitest';
import { Battle } from '../src/battle/Battle';
import { createMonster, statsOf, type Monster } from '../src/battle/monster';
import { MOVES } from '../src/data/moves';
import { SPECIES, type SpeciesId } from '../src/data/species';
import { TYPE_CHART } from '../src/data/typeChart';
import { Rng } from '../src/engine/rng';
import { STARTERS } from '../src/scenes/StarterScene';
import { RIVAL_COUNTER, TRAINER_TEAMS } from '../src/world/events';

/** A simple player: strongest expected hit, a potion when low. */
function play(party: Monster[], foes: [SpeciesId, number][], seed: string): boolean {
  const inventory = { potion: 3, catchOrb: 0 };
  const b = new Battle({
    playerParty: party,
    foeParty: foes.map(([s, l]) => createMonster(s, l)),
    inventory,
    rng: new Rng(seed),
    trainerName: 'Test',
  });
  for (let turn = 0; turn < 200 && !b.outcome; turn++) {
    if (b.needsSwitch) {
      b.switchTo(party.findIndex((m) => m.hp > 0));
      continue;
    }
    const me = b.activeOf('player');
    const foeType = SPECIES[b.activeOf('foe').species].type;
    if (inventory.potion > 0 && me.hp < statsOf(me).maxHp * 0.3) {
      b.usePotion();
      continue;
    }
    const value = (id: (typeof me.moves)[number]) => {
      const m = MOVES[id];
      return m.power * m.accuracy * TYPE_CHART[m.type][foeType] * (m.type === SPECIES[me.species].type ? 1.5 : 1);
    };
    const best = me.moves.reduce((bi, id, i) => (value(id) > value(me.moves[bi]) ? i : bi), 0);
    b.fight(best);
  }
  return b.outcome === 'win';
}

function winRate(makeParty: () => Monster[], foes: [SpeciesId, number][], tag: string): number {
  let wins = 0;
  for (let i = 0; i < 100; i++) if (play(makeParty(), foes, `${tag}-${i}`)) wins++;
  return wins / 100;
}

describe('difficulty curve', () => {
  it.each(STARTERS)('%s can beat Kael on the trail at level 10', (starter) => {
    const foes = TRAINER_TEAMS.rivalRoute(RIVAL_COUNTER[starter]);
    expect(winRate(() => [createMonster(starter, 10)], foes, starter)).toBeGreaterThan(0.5);
  });

  it.each(STARTERS)('%s with a caught Brambun can beat Leader Basalt around level 12', (starter) => {
    const party = () => [createMonster(starter, 12), createMonster('brambun', 10)];
    expect(winRate(party, TRAINER_TEAMS.basalt, starter)).toBeGreaterThan(0.5);
  });

  it('Basalt is still a real fight for an unprepared Embrit', () => {
    expect(winRate(() => [createMonster('embrit', 11)], TRAINER_TEAMS.basalt, 'solo')).toBeLessThan(0.5);
  });
});
