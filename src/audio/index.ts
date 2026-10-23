import { AudioEngine } from './AudioEngine';

/** The one audio engine for the whole game. */
export const audio = new AudioEngine();
export type { SongId } from './music';
export type { SfxId } from './sfx';
