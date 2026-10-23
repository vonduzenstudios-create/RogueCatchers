import { describe, expect, it } from 'vitest';
import { hsl, ramp } from '../src/gen/color';

describe('hsl', () => {
  it('converts primary colours', () => {
    expect(hsl(0, 1, 0.5)).toBe('#ff0000');
    expect(hsl(120, 1, 0.5)).toBe('#00ff00');
    expect(hsl(240, 1, 0.5)).toBe('#0000ff');
    expect(hsl(0, 0, 1)).toBe('#ffffff');
  });

  it('wraps hue and clamps lightness', () => {
    expect(hsl(360, 1, 0.5)).toBe('#ff0000');
    expect(hsl(-120, 1, 0.5)).toBe('#0000ff');
    expect(hsl(0, 1, 2)).toBe('#ffffff');
  });
});

describe('ramp', () => {
  it('gives four distinct shades from dark to light', () => {
    const r = ramp(20, 0.8, 0.5);
    expect(new Set(r).size).toBe(4);
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(lum(r[0])).toBeLessThan(lum(r[1]));
    expect(lum(r[1])).toBeLessThan(lum(r[2]));
    expect(lum(r[2])).toBeLessThan(lum(r[3]));
  });
});
