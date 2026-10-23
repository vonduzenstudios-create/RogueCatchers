/** Hash a string into a 32-bit seed (FNV-1a). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Small, fast seeded random number generator (mulberry32).
 * The same seed always produces the same sequence, which keeps
 * generated art and encounters reproducible.
 */
export class Rng {
  private state: number;

  constructor(seed: number | string) {
    this.state = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with an empty array');
    return items[Math.floor(this.next() * items.length)];
  }

  /** Derive an independent generator, e.g. one per monster or map. */
  fork(label: string): Rng {
    return new Rng((hashString(label) ^ Math.floor(this.next() * 4294967296)) >>> 0);
  }
}
