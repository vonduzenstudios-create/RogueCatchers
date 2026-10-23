import { describe, expect, it } from 'vitest';
import { effectiveness } from '../src/data/typeChart';
import { SPECIES } from '../src/data/species';
import { Rng } from '../src/engine/rng';
import { RIVAL_COUNTER, rollEncounter } from '../src/world/events';
import { WORLD } from '../src/world/maps';
import { STARTERS } from '../src/scenes/StarterScene';

describe('story setup', () => {
  it("gives Kael a different starter that is weak to the player's, for a fair first battle", () => {
    for (const mine of STARTERS) {
      const theirs = RIVAL_COUNTER[mine];
      expect(theirs).not.toBe(mine);
      expect(effectiveness(SPECIES[mine].type, SPECIES[theirs].type)).toBe(2);
    }
  });

  it('only rolls monsters from the encounter table, within its levels', () => {
    const table = WORLD.mosswayTrail.encounters;
    expect(table.length).toBe(5);
    const rng = new Rng('encounters');
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const { species, level } = rollEncounter(table, rng);
      const slot = table.find((s) => s.species === species)!;
      expect(level).toBeGreaterThanOrEqual(slot.minLevel);
      expect(level).toBeLessThanOrEqual(slot.maxLevel);
      seen.add(species);
    }
    expect(seen.size).toBe(5);
  });

  it('blocks the way north until the lab battle is won', () => {
    expect(WORLD.emberHollow.gates.every((g) => g.flag === 'beatRivalLab')).toBe(true);
  });
});
