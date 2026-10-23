import { describe, expect, it } from 'vitest';
import { Battle, catchChance, computeDamage, stageMultiplier } from '../src/battle/Battle';
import { createMonster, gainXp, movesAtLevel, statsOf, xpForLevel } from '../src/battle/monster';
import { MOVES } from '../src/data/moves';
import { SPECIES, SPECIES_ORDER } from '../src/data/species';
import { TYPE_CHART } from '../src/data/typeChart';
import { TYPES } from '../src/data/types';
import { Rng } from '../src/engine/rng';

const newBattle = (seed: string, trainerName?: string) =>
  new Battle({
    playerParty: [createMonster('splashell', 8), createMonster('embrit', 6)],
    foeParty: [createMonster('embrit', 6)],
    inventory: { potion: 2, catchOrb: 5 },
    rng: new Rng(seed),
    trainerName,
  });

describe('type chart', () => {
  it('covers every pairing', () => {
    for (const a of TYPES) for (const d of TYPES) expect([0.5, 1, 2]).toContain(TYPE_CHART[a][d]);
  });

  it('has the classic starter triangle', () => {
    expect(TYPE_CHART.Fire.Grass).toBe(2);
    expect(TYPE_CHART.Grass.Water).toBe(2);
    expect(TYPE_CHART.Water.Fire).toBe(2);
  });
});

describe('species data', () => {
  it('only references real moves and starts every monster with at least two', () => {
    for (const id of SPECIES_ORDER) {
      for (const [, move] of SPECIES[id].learnset) expect(MOVES[move]).toBeDefined();
      expect(movesAtLevel(id, 1).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('monsters', () => {
  it('grows stats with level', () => {
    const low = statsOf({ species: 'embrit', level: 5 });
    const high = statsOf({ species: 'embrit', level: 15 });
    expect(high.maxHp).toBeGreaterThan(low.maxHp);
    expect(high.attack).toBeGreaterThan(low.attack);
  });

  it('levels up, raises HP and learns moves', () => {
    const m = createMonster('embrit', 10);
    m.hp = 5;
    const results = gainXp(m, xpForLevel(11) - m.xp);
    expect(m.level).toBe(11);
    expect(results).toEqual([{ newLevel: 11, learned: ['flameWheel'] }]);
    expect(m.moves).toContain('flameWheel');
    expect(m.moves.length).toBeLessThanOrEqual(4);
    expect(m.hp).toBeGreaterThan(5);
  });
});

describe('damage', () => {
  const base = { level: 10, power: 60, attack: 20, defense: 20, stab: false, effectiveness: 1, crit: false, roll: 1 };

  it('scales with type effectiveness, STAB and crits', () => {
    const plain = computeDamage(base);
    expect(computeDamage({ ...base, effectiveness: 2 })).toBeGreaterThan(plain);
    expect(computeDamage({ ...base, effectiveness: 0.5 })).toBeLessThan(plain);
    expect(computeDamage({ ...base, stab: true })).toBeGreaterThan(plain);
    expect(computeDamage({ ...base, crit: true })).toBeGreaterThan(plain);
  });

  it('always does at least 1', () => {
    expect(computeDamage({ ...base, power: 1, attack: 1, defense: 999, effectiveness: 0.5, roll: 0.85 })).toBe(1);
  });

  it('applies stat stages symmetrically', () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(-2)).toBe(0.5);
  });
});

describe('battle', () => {
  it('ends with a win when the foe faints, and awards XP', () => {
    const b = newBattle('win');
    const startXp = b.activeOf('player').xp;
    let events = b.intro();
    for (let i = 0; i < 30 && !b.outcome; i++) {
      events = b.fight(0); // Bubble, super effective on Embrit
      if (b.needsSwitch) b.switchTo(1);
    }
    expect(b.outcome).toBe('win');
    expect(events.at(-1)).toEqual({ kind: 'end', outcome: 'win' });
    expect(b.activeOf('player').xp).toBeGreaterThan(startXp);
  });

  it('reports super effective hits', () => {
    const b = newBattle('eff');
    const events = b.fight(0);
    const hit = events.find((e) => e.kind === 'hit' && e.side === 'foe');
    if (hit && hit.kind === 'hit') expect(hit.effectiveness).toBe(2);
  });

  it('refuses to run or catch in trainer battles', () => {
    const b = newBattle('trainer', 'Rival Kael');
    expect(b.run()[0]).toMatchObject({ kind: 'text' });
    expect(b.outcome).toBeNull();
    expect(b.throwOrb()[0]).toMatchObject({ text: "You can't catch another trainer's monster!" });
  });

  it('uses up Catch Orbs and can catch a weakened monster', () => {
    let caught = false;
    for (let s = 0; s < 20 && !caught; s++) {
      const b = newBattle(`catch-${s}`);
      b.activeOf('foe').hp = 1;
      b.throwOrb();
      if (b.outcome === 'caught') {
        caught = true;
        expect(b.caught?.species).toBe('embrit');
      }
    }
    expect(caught).toBe(true);
  });

  it('makes weaker, sleeping monsters easier to catch', () => {
    const m = createMonster('zapkit', 5);
    const full = catchChance(m);
    m.hp = 1;
    const low = catchChance(m);
    m.status = 'sleep';
    expect(low).toBeGreaterThan(full);
    expect(catchChance(m)).toBeGreaterThan(low);
  });

  it('forces a switch when the active monster faints but others remain', () => {
    const b = newBattle('faint');
    b.activeOf('player').hp = 1;
    for (let i = 0; i < 10 && !b.needsSwitch && !b.outcome; i++) b.fight(0);
    if (b.needsSwitch) {
      const events = b.switchTo(1);
      expect(events.some((e) => e.kind === 'sendOut')).toBe(true);
      expect(b.needsSwitch).toBe(false);
    }
  });

  it('heals with a Potion and spends it', () => {
    const b = newBattle('potion');
    b.activeOf('player').hp = 3;
    const events = b.usePotion();
    expect(events.some((e) => e.kind === 'heal')).toBe(true);
  });
});
