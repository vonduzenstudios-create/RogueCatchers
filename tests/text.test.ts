import { describe, expect, it } from 'vitest';
import { measureText } from '../src/gen/font';
import { wrapText } from '../src/ui/text';

describe('wrapText', () => {
  it('keeps every line within the width', () => {
    const lines = wrapText('Ah, there you are! I am Professor Alder and this is my lab.', 60);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measureText(line)).toBeLessThanOrEqual(60);
    expect(lines.join(' ')).toBe('Ah, there you are! I am Professor Alder and this is my lab.');
  });

  it('puts an over-long word on its own line rather than dropping it', () => {
    expect(wrapText('Supercalifragilistic', 20)).toEqual(['Supercalifragilistic']);
  });
});
