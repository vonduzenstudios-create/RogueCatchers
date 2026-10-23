import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '../src/engine/rng';

describe('Rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = new Rng('starter');
    const b = new Rng('starter');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds', () => {
    expect(new Rng('embrit').next()).not.toEqual(new Rng('splashell').next());
  });

  it('keeps values in range', () => {
    const rng = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('forks into independent but reproducible streams', () => {
    const forkA = new Rng(1).fork('map');
    const forkB = new Rng(1).fork('map');
    expect(forkA.next()).toEqual(forkB.next());
    expect(new Rng(1).fork('map').next()).not.toEqual(new Rng(1).fork('music').next());
  });

  it('hashes strings stably', () => {
    expect(hashString('RogueCatchers')).toBe(hashString('RogueCatchers'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});
