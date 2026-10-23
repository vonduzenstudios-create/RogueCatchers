import { type NoteEvent, SONGS, type SongId, songBeats, songEvents } from './music';
import { SFX, type SfxId, type SfxKit } from './sfx';

/** How far ahead (seconds) notes are queued, and how often the queue is topped up. */
const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const MUSIC_VOLUME = 0.32;
const SFX_VOLUME = 0.5;
const MUTE_KEY = 'roguecatchers.muted';

interface Playing {
  id: SongId;
  events: NoteEvent[];
  beats: number;
  secPerBeat: number;
  loop: boolean;
  gain: GainNode;
  /** Audio time the current pass started. */
  passStart: number;
  next: number;
}

/**
 * All the game's sound: a small chiptune sequencer and synth sound effects,
 * built on plain Web Audio. Browsers only allow audio after a key press or
 * click, so nothing plays until `unlock` runs; until then requests are remembered.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private kit!: SfxKit;
  private pulseWave!: PeriodicWave;
  private song: Playing | null = null;
  private wanted: SongId | null = null;
  private jingleUntil = 0;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // Storage can be blocked; sound simply starts unmuted.
    }
  }

  /** Hook the first key press or click to start audio, and M to mute. */
  attach(target: Window = window): void {
    const unlock = () => this.unlock();
    target.addEventListener('keydown', unlock);
    target.addEventListener('pointerdown', unlock);
    target.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggleMute();
    });
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = MUSIC_VOLUME;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = SFX_VOLUME;
    this.sfxBus.connect(this.master);
    this.kit = { ctx, out: this.sfxBus, noise: makeNoise(ctx) };
    this.pulseWave = makePulseWave(ctx, 0.25);
    window.setInterval(() => this.tick(), TICK_MS);
    if (this.wanted) this.startSong(this.wanted);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Not saved; the toggle still applies to this session.
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  /** Switch the background music; the same song keeps playing uninterrupted. */
  music(id: SongId | null): void {
    if (id === this.wanted && (this.song?.id === id || !this.ctx)) return;
    this.wanted = id;
    if (!this.ctx) return;
    this.stopSong();
    if (id) this.startSong(id);
  }

  /** A one-shot tune over the music, which ducks out until it finishes. */
  jingle(id: SongId): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const song = SONGS[id];
    const secPerBeat = 60 / song.bpm;
    const now = ctx.currentTime + 0.05;
    const length = songBeats(song) * secPerBeat;
    this.musicBus.gain.setTargetAtTime(0, now, 0.03);
    this.musicBus.gain.setTargetAtTime(MUSIC_VOLUME, now + length + 0.2, 0.2);
    this.jingleUntil = now + length;
    for (const e of songEvents(song)) this.playNote(e, now + e.beat * secPerBeat, e.length * secPerBeat, this.sfxBus);
  }

  sfx(id: SfxId): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    SFX[id](this.kit, this.ctx.currentTime + 0.005);
  }

  /** Seconds left in the current jingle, so scripts can wait for it. */
  get jingleRemaining(): number {
    return this.ctx ? Math.max(0, this.jingleUntil - this.ctx.currentTime) : 0;
  }

  private startSong(id: SongId): void {
    const ctx = this.ctx!;
    const song = SONGS[id];
    const gain = ctx.createGain();
    gain.connect(this.musicBus);
    this.song = {
      id,
      events: songEvents(song),
      beats: songBeats(song),
      secPerBeat: 60 / song.bpm,
      loop: song.loop,
      gain,
      passStart: ctx.currentTime + 0.08,
      next: 0,
    };
    this.tick();
  }

  private stopSong(): void {
    const s = this.song;
    if (!s || !this.ctx) return;
    // A short fade so already-queued notes don't cut off with a click.
    s.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    const gain = s.gain;
    window.setTimeout(() => gain.disconnect(), 600);
    this.song = null;
  }

  private tick(): void {
    const ctx = this.ctx;
    const s = this.song;
    if (!ctx || !s) return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    for (;;) {
      if (s.next >= s.events.length) {
        if (!s.loop) return;
        s.next = 0;
        s.passStart += s.beats * s.secPerBeat;
      }
      const e = s.events[s.next];
      const t = s.passStart + e.beat * s.secPerBeat;
      if (t > horizon) return;
      // After a long stall (a background tab), skip ahead instead of bursting.
      if (t >= ctx.currentTime - 0.05) this.playNote(e, t, e.length * s.secPerBeat, s.gain);
      s.next++;
    }
  }

  private playNote(e: NoteEvent, t: number, dur: number, out: AudioNode): void {
    playNote(this.kit, this.pulseWave, out, e, t, dur);
  }
}

/**
 * Render a song offline (no speakers needed), for previews and downloads.
 * Plays one pass, or `seconds` of a looping song.
 */
export async function renderSong(id: SongId, seconds?: number): Promise<AudioBuffer> {
  const song = SONGS[id];
  const secPerBeat = 60 / song.bpm;
  const pass = songBeats(song) * secPerBeat;
  const length = seconds ?? pass + 0.5;
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(length * rate), rate);
  const kit: SfxKit = { ctx: ctx as unknown as AudioContext, out: ctx.destination, noise: makeNoise(ctx) };
  const out = ctx.createGain();
  out.gain.value = MUSIC_VOLUME * 2;
  out.connect(ctx.destination);
  const wave = makePulseWave(ctx, 0.25);
  const events = songEvents(song);
  for (let start = 0; start < length; start += pass) {
    for (const e of events) {
      const t = start + e.beat * secPerBeat;
      if (t < length) playNote(kit, wave, out, e, t, e.length * secPerBeat);
    }
    if (!song.loop) break;
  }
  return ctx.startRendering();
}

function playNote(k: SfxKit, wave: PeriodicWave, out: AudioNode, e: NoteEvent, t: number, dur: number): void {
  const ctx = k.ctx;
  if (e.voice === 'drums') {
    playDrum(k, out, e.pitch as 'k' | 's' | 'h', t, e.volume);
    return;
  }
  const osc = ctx.createOscillator();
  if (e.voice === 'pulse') osc.setPeriodicWave(wave);
  else osc.type = e.voice;
  osc.frequency.setValueAtTime(e.pitch as number, t);
  const gain = ctx.createGain();
  const peak = e.volume * (e.voice === 'triangle' ? 0.9 : 0.35);
  const end = t + Math.max(0.05, dur * 0.92);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.005);
  gain.gain.setTargetAtTime(peak * 0.7, t + 0.01, 0.08);
  gain.gain.setTargetAtTime(0, end - 0.02, 0.015);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(end + 0.08);
}

function playDrum(k: SfxKit, out: AudioNode, kind: 'k' | 's' | 'h', t: number, vol: number): void {
  const ctx = k.ctx;
  if (kind === 'k') {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.16);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = k.noise;
  const filter = ctx.createBiquadFilter();
  filter.type = kind === 's' ? 'bandpass' : 'highpass';
  filter.frequency.value = kind === 's' ? 1800 : 7000;
  const g = ctx.createGain();
  const len = kind === 's' ? 0.12 : 0.035;
  g.gain.setValueAtTime(vol * (kind === 's' ? 0.7 : 0.35), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.connect(filter).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + len + 0.01);
}

function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** The NES-style narrow pulse wave, from its Fourier series. */
function makePulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty) * Math.cos(i * Math.PI * duty);
    imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty) * Math.sin(i * Math.PI * duty);
  }
  return ctx.createPeriodicWave(real, imag);
}
