/**
 * Chiptune songs written as note strings, plus the parser that turns them
 * into timed note events. No Web Audio here, so it can be unit tested.
 *
 * A track is space-separated tokens, each one `step` beats long:
 *   `C5`, `F#4`, `Bb3`  a note        `-`  hold the previous note
 *   `.`                 a rest        `k` `s` `h`  kick, snare, hat (drum tracks)
 * Shorter tracks loop inside the song, so a one-bar drum loop is fine.
 */

export type Voice = 'pulse' | 'square' | 'triangle' | 'drums';

export interface Track {
  voice: Voice;
  /** Beats per token. */
  step: number;
  volume: number;
  notes: string;
}

export interface Song {
  bpm: number;
  loop: boolean;
  /** Semitones to shift every pitched note. */
  transpose?: number;
  tracks: Track[];
}

export interface NoteEvent {
  /** Start, in beats from the song's start. */
  beat: number;
  /** Length in beats. */
  length: number;
  voice: Voice;
  volume: number;
  /** Frequency in Hz for pitched voices; the drum name for drums. */
  pitch: number | 'k' | 's' | 'h';
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Frequency of a note name like `A4` (440 Hz), `C#5` or `Bb3`. */
export function noteFrequency(name: string, transpose = 0): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note "${name}"`);
  const semis = SEMITONES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12 + transpose;
  return 440 * 2 ** ((semis - 69) / 12);
}

export function trackBeats(track: Track): number {
  return tokens(track.notes).length * track.step;
}

/** Length of one pass through the song, in beats. */
export function songBeats(song: Song): number {
  return Math.max(...song.tracks.map(trackBeats));
}

/** Every note in one pass of the song, sorted by start time. */
export function songEvents(song: Song): NoteEvent[] {
  const total = songBeats(song);
  const events: NoteEvent[] = [];
  for (const track of song.tracks) {
    const toks = tokens(track.notes);
    const passBeats = toks.length * track.step;
    for (let offset = 0; offset < total - 1e-9; offset += passBeats) {
      let current: NoteEvent | null = null;
      toks.forEach((tok, i) => {
        const beat = offset + i * track.step;
        if (tok === '-') {
          if (current) current.length += track.step;
          return;
        }
        current = null;
        if (tok === '.') return;
        const pitch = track.voice === 'drums' ? drum(tok) : noteFrequency(tok, song.transpose);
        current = { beat, length: track.step, voice: track.voice, volume: track.volume, pitch };
        events.push(current);
      });
    }
  }
  return events.sort((a, b) => a.beat - b.beat);
}

function tokens(notes: string): string[] {
  return notes.trim().split(/\s+/);
}

function drum(tok: string): 'k' | 's' | 'h' {
  if (tok === 'k' || tok === 's' || tok === 'h') return tok;
  throw new Error(`Bad drum "${tok}"`);
}

const rep = (s: string, n: number) => Array(n).fill(s).join(' ');

/** Broken-chord sixteenths: up and back down the chord for one bar of 4/4. */
function arp(...chords: string[]): string {
  return chords
    .map((c) => {
      const [a, b, d] = c.split(' ');
      return rep(`${a} ${b} ${d} ${b}`, 4);
    })
    .join(' ');
}

/** Root-fifth eighth notes for a bar per chord root, e.g. `bounce('C3 G3', 'A2 E3')`. */
function bounce(...pairs: string[]): string {
  return pairs.map((p) => rep(p, 4)).join(' ');
}

const TOWN: Song = {
  bpm: 112,
  loop: true,
  tracks: [
    {
      voice: 'pulse',
      step: 0.5,
      volume: 0.5,
      notes: `
        E5 . G5 . C6 - B5 A5   A5 - G5 E5 - . C5 D5   F5 . A5 . C6 - A5 F5   G5 - - . D5 E5 F5 D5
        E5 . G5 . C6 - D6 E6   C6 - A5 . E5 - G5 A5   F5 - A5 G5 F5 - E5 D5  C5 - - - . . . .`,
    },
    { voice: 'triangle', step: 0.5, volume: 0.6, notes: bounce('C3 G3', 'A2 E3', 'F2 C3', 'G2 D3', 'C3 G3', 'A2 E3', 'F2 C3', 'G2 G2') },
    { voice: 'square', step: 0.25, volume: 0.12, notes: arp('C4 E4 G4', 'A3 C4 E4', 'F3 A3 C4', 'G3 B3 D4') },
    { voice: 'drums', step: 0.5, volume: 0.5, notes: 'k . h . s . h .' },
  ],
};

const ROUTE: Song = {
  bpm: 140,
  loop: true,
  tracks: [
    {
      voice: 'pulse',
      step: 0.5,
      volume: 0.5,
      notes: `
        D5 . G5 . B5 - A5 G5   A5 - F#5 . D5 - E5 F#5   G5 - B5 . E6 - D6 B5   C6 - - B5 A5 - G5 A5
        B5 . D6 . G6 - F#6 E6  D6 - A5 . F#5 - A5 D6    E6 - C6 . G5 - A5 B5   A5 - - - F#5 - D5 -`,
    },
    {
      voice: 'triangle',
      step: 0.5,
      volume: 0.6,
      notes: bounce('G2 G3', 'D3 D3', 'E2 E3', 'C3 C3', 'G2 G3', 'D3 D3', 'C3 C3', 'D3 D3'),
    },
    { voice: 'square', step: 0.25, volume: 0.1, notes: arp('G3 B3 D4', 'D4 F#4 A4', 'E4 G4 B4', 'C4 E4 G4', 'G3 B3 D4', 'D4 F#4 A4', 'C4 E4 G4', 'D4 F#4 A4') },
    { voice: 'drums', step: 0.5, volume: 0.5, notes: 'k h s h k k s h' },
  ],
};

const BATTLE: Song = {
  bpm: 168,
  loop: true,
  tracks: [
    {
      voice: 'pulse',
      step: 0.5,
      volume: 0.5,
      notes: `
        A5 . A5 C6 . A5 E6 .   F5 . A5 . C6 - A5 .    G5 . B5 . D6 - B5 G5   G#5 - B5 - E6 - D6 B5
        C6 - B5 A5 E5 - A5 B5  C6 - D6 C6 A5 - F5 A5  B5 - C6 B5 G5 - D5 G5  G#5 - - - E5 - . .`,
    },
    { voice: 'triangle', step: 0.5, volume: 0.65, notes: bounce('A2 A3', 'F2 F3', 'G2 G3', 'E2 E3') },
    { voice: 'square', step: 0.25, volume: 0.1, notes: arp('A4 C5 E5', 'F4 A4 C5', 'G4 B4 D5', 'E4 G#4 B4') },
    { voice: 'drums', step: 0.25, volume: 0.5, notes: 'k . h . s . h k k . h . s . h h' },
  ],
};

const LEADER: Song = {
  bpm: 176,
  loop: true,
  tracks: [
    {
      voice: 'pulse',
      step: 0.5,
      volume: 0.5,
      notes: `
        E5 . G5 . B5 . E6 .    E6 - D6 C6 B5 - G5 .   F#5 . A5 . D6 . F#6 .  D#6 - - B5 F#5 - D#5 .
        G5 - F#5 E5 B5 - E6 -  C6 - B5 A5 G5 - E5 -   D6 - C6 B5 A5 - F#5 -  B5 - - - D#6 - - -`,
    },
    { voice: 'triangle', step: 0.5, volume: 0.65, notes: bounce('E2 E3', 'C2 C3', 'D2 D3', 'B1 B2') },
    { voice: 'square', step: 0.25, volume: 0.1, notes: arp('E4 G4 B4', 'C4 E4 G4', 'D4 F#4 A4', 'B3 D#4 F#4') },
    { voice: 'drums', step: 0.25, volume: 0.55, notes: 'k . h k s . h . k . h k s . s s' },
  ],
};

const GYM: Song = {
  bpm: 116,
  loop: true,
  tracks: [
    {
      voice: 'pulse',
      step: 0.5,
      volume: 0.45,
      notes: `
        D5 . . D5 F5 . A5 .   Bb5 - A5 . F5 - D5 .   E5 . . E5 G5 . C6 .   C#6 - - - A5 - - -`,
    },
    { voice: 'triangle', step: 1, volume: 0.6, notes: 'D3 A2 D3 A2 Bb2 F2 Bb2 F2 C3 G2 C3 G2 A2 E2 A2 C#3' },
    { voice: 'drums', step: 0.5, volume: 0.45, notes: 'k . s . k k s .' },
  ],
};

const TITLE: Song = {
  bpm: 100,
  loop: true,
  tracks: [
    {
      voice: 'pulse',
      step: 0.5,
      volume: 0.5,
      notes: `
        C5 - F5 - A5 - C6 -   G5 - - - E5 - - -   F5 - A5 - D6 - C6 -   A5 - - - - - . .
        C6 - A5 - F5 - A5 -   G5 - E5 - C5 - E5 -  F5 - D5 - Bb5 - A5 G5  G5 - - - - - - -`,
    },
    { voice: 'triangle', step: 1, volume: 0.6, notes: 'F2 C3 F3 C3 E2 C3 G3 C3 D2 A2 D3 A2 Bb1 F2 Bb2 F2 F2 C3 F3 C3 C2 G2 C3 G2 Bb1 F2 Bb2 F2 C2 G2 C3 E3' },
    { voice: 'square', step: 0.25, volume: 0.08, notes: arp('F4 A4 C5', 'E4 G4 C5', 'D4 F4 A4', 'D4 F4 Bb4', 'F4 A4 C5', 'E4 G4 C5', 'D4 F4 Bb4', 'E4 G4 C5') },
    { voice: 'drums', step: 1, volume: 0.35, notes: 'k h s h' },
  ],
};

const VICTORY: Song = {
  bpm: 150,
  loop: false,
  tracks: [
    { voice: 'pulse', step: 0.5, volume: 0.55, notes: 'G5 G5 G5 . E5 . C6 - - - . G5 C6 - - - - - - -' },
    { voice: 'square', step: 0.5, volume: 0.25, notes: 'E5 E5 E5 . C5 . G5 - - - . E5 G5 - - - - - - -' },
    { voice: 'triangle', step: 0.5, volume: 0.6, notes: 'C3 C3 C3 . C3 . E3 - - - . G2 C3 - - - - - - -' },
  ],
};

const HEAL: Song = {
  bpm: 120,
  loop: false,
  tracks: [
    { voice: 'pulse', step: 0.25, volume: 0.5, notes: 'C5 E5 G5 C6 - - G5 - C6 - - - E6 - - - - - - -' },
    { voice: 'triangle', step: 0.5, volume: 0.5, notes: 'C3 - G2 - C3 - - - - -' },
  ],
};

export const SONGS = {
  title: TITLE,
  town: TOWN,
  /** Basalt Ridge: the town theme, a little lower and slower. */
  town2: { ...TOWN, bpm: 104, transpose: -3 },
  route: ROUTE,
  gym: GYM,
  battle: BATTLE,
  trainer: { ...BATTLE, bpm: 176, transpose: 2 },
  leader: LEADER,
  victory: VICTORY,
  heal: HEAL,
} satisfies Record<string, Song>;

export type SongId = keyof typeof SONGS;
