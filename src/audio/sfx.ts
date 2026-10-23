/**
 * Sound effects as tiny synth recipes. Each one schedules a few
 * oscillators or noise bursts on the given context, starting at `t`.
 */

export type SfxId =
  | 'cursor'
  | 'confirm'
  | 'cancel'
  | 'text'
  | 'bump'
  | 'door'
  | 'encounter'
  | 'attack'
  | 'hit'
  | 'hitSuper'
  | 'hitWeak'
  | 'faint'
  | 'statUp'
  | 'statDown'
  | 'potion'
  | 'throw'
  | 'shake'
  | 'breakFree'
  | 'levelUp'
  | 'coin';

export interface SfxKit {
  ctx: AudioContext;
  out: AudioNode;
  noise: AudioBuffer;
}

type Wave = OscillatorType;

/** One oscillator with a pitch slide and a quick fade out. */
function tone(k: SfxKit, t: number, wave: Wave, from: number, to: number, dur: number, vol: number): void {
  const osc = k.ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = k.ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(k.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Filtered white noise; `sweepTo` slides the filter for whooshes. */
function noise(k: SfxKit, t: number, dur: number, vol: number, freq: number, sweepTo = freq, type: BiquadFilterType = 'bandpass'): void {
  const src = k.ctx.createBufferSource();
  src.buffer = k.noise;
  const filter = k.ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t);
  if (sweepTo !== freq) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const gain = k.ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(k.out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/** Quick ascending notes, `gap` seconds apart. */
function arpeggio(k: SfxKit, t: number, freqs: number[], gap: number, wave: Wave = 'square', vol = 0.18): void {
  freqs.forEach((f, i) => tone(k, t + i * gap, wave, f, f, gap * 1.6, vol));
}

export const SFX: Record<SfxId, (k: SfxKit, t: number) => void> = {
  cursor: (k, t) => tone(k, t, 'square', 1320, 1320, 0.04, 0.12),
  confirm: (k, t) => arpeggio(k, t, [988, 1480], 0.05, 'square', 0.14),
  cancel: (k, t) => arpeggio(k, t, [740, 494], 0.05, 'square', 0.12),
  text: (k, t) => tone(k, t, 'square', 1760, 1760, 0.025, 0.06),
  bump: (k, t) => tone(k, t, 'triangle', 110, 70, 0.1, 0.4),
  door: (k, t) => {
    noise(k, t, 0.25, 0.25, 1200, 300);
    tone(k, t, 'triangle', 220, 140, 0.2, 0.25);
  },
  encounter: (k, t) => {
    arpeggio(k, t, [330, 440, 554, 659, 880, 1109, 1319], 0.04, 'square', 0.15);
    noise(k, t + 0.2, 0.3, 0.15, 3000, 600);
  },
  attack: (k, t) => noise(k, t, 0.18, 0.25, 600, 4000),
  hit: (k, t) => {
    noise(k, t, 0.15, 0.45, 1500, 400, 'lowpass');
    tone(k, t, 'square', 300, 80, 0.15, 0.2);
  },
  hitSuper: (k, t) => {
    noise(k, t, 0.3, 0.6, 3000, 300, 'lowpass');
    tone(k, t, 'square', 500, 60, 0.3, 0.25);
    tone(k, t + 0.08, 'square', 400, 50, 0.25, 0.2);
  },
  hitWeak: (k, t) => {
    noise(k, t, 0.1, 0.3, 800, 300, 'lowpass');
    tone(k, t, 'triangle', 200, 100, 0.1, 0.25);
  },
  faint: (k, t) => tone(k, t, 'square', 700, 60, 0.7, 0.18),
  statUp: (k, t) => tone(k, t, 'square', 400, 1600, 0.35, 0.12),
  statDown: (k, t) => tone(k, t, 'square', 1600, 300, 0.35, 0.12),
  potion: (k, t) => arpeggio(k, t, [1047, 1319, 1568, 2093, 1568, 2093], 0.05, 'triangle', 0.3),
  throw: (k, t) => noise(k, t, 0.35, 0.2, 400, 3000),
  shake: (k, t) => {
    tone(k, t, 'square', 200, 120, 0.06, 0.2);
    noise(k, t, 0.05, 0.2, 2500);
  },
  breakFree: (k, t) => {
    noise(k, t, 0.2, 0.4, 2000, 6000, 'highpass');
    tone(k, t, 'square', 300, 900, 0.15, 0.15);
  },
  levelUp: (k, t) => arpeggio(k, t, [523, 659, 784, 659, 784, 1047, 1319], 0.07, 'square', 0.16),
  coin: (k, t) => {
    tone(k, t, 'square', 988, 988, 0.08, 0.15);
    tone(k, t + 0.08, 'square', 1319, 1319, 0.3, 0.15);
  },
};
