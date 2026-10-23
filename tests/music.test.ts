import { describe, expect, it } from 'vitest';
import { SONGS, noteFrequency, songBeats, songEvents, trackBeats } from '../src/audio/music';

describe('note frequencies', () => {
  it('tunes A4 to 440 Hz and handles sharps, flats and octaves', () => {
    expect(noteFrequency('A4')).toBeCloseTo(440);
    expect(noteFrequency('A5')).toBeCloseTo(880);
    expect(noteFrequency('C#5')).toBeCloseTo(noteFrequency('Db5'));
    expect(noteFrequency('C4')).toBeCloseTo(261.63, 1);
    expect(noteFrequency('A4', 12)).toBeCloseTo(880);
  });

  it('rejects nonsense', () => {
    expect(() => noteFrequency('H2')).toThrow();
  });
});

describe('songs', () => {
  for (const [id, song] of Object.entries(SONGS)) {
    it(`${id} parses and every track fits the loop evenly`, () => {
      const total = songBeats(song);
      for (const track of song.tracks) {
        const ratio = total / trackBeats(track);
        expect(ratio, `${id} ${track.voice}`).toBe(Math.round(ratio));
      }
      const events = songEvents(song);
      expect(events.length).toBeGreaterThan(0);
      for (const e of events) {
        expect(e.beat + e.length).toBeLessThanOrEqual(total + 1e-9);
        if (typeof e.pitch === 'number') expect(e.pitch).toBeGreaterThan(30);
      }
    });
  }

  it('holds notes with "-" and rests with "."', () => {
    const events = songEvents({ bpm: 120, loop: false, tracks: [{ voice: 'pulse', step: 1, volume: 1, notes: 'C4 - - . E4' }] });
    expect(events.map((e) => [e.beat, e.length])).toEqual([
      [0, 3],
      [4, 1],
    ]);
  });
});
