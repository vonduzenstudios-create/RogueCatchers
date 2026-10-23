import { SPECIES } from '../data/species';
import { WORLD } from '../world/maps';
import { type GameState, newGameState } from './GameState';

const SAVE_KEY = 'roguecatchers.save';
const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  savedAt: number;
  state: GameState;
}

/** The bits of `Storage` we use, so tests can pass a plain object. */
export type SaveStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStore(): SaveStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Storage blocked (private mode, sandboxed iframe): the game just won't save.
    return null;
  }
}

/** Write the game to browser storage. Returns false if storage is unavailable or full. */
export function saveGame(state: GameState, store = defaultStore()): boolean {
  if (!store) return false;
  const file: SaveFile = { version: SAVE_VERSION, savedAt: Date.now(), state };
  try {
    store.setItem(SAVE_KEY, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the saved game, or null if there is none or it can't be used.
 * Missing fields (from older saves) are filled in with new-game defaults.
 */
export function loadGame(store = defaultStore()): GameState | null {
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const file = JSON.parse(raw) as Partial<SaveFile>;
    if (file.version !== SAVE_VERSION || !file.state) return null;
    const base = newGameState();
    const s = file.state;
    const state: GameState = {
      ...base,
      ...s,
      inventory: { ...base.inventory, ...s.inventory },
      flags: { ...s.flags },
      stats: { ...base.stats, ...s.stats },
    };
    return isValid(state) ? state : null;
  } catch {
    return null;
  }
}

export function deleteSave(store = defaultStore()): void {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do; a stale save is harmless.
  }
}

/** Guard against hand-edited or corrupted saves that would crash the game. */
function isValid(s: GameState): boolean {
  const map = WORLD[s.map];
  if (!map || !Number.isInteger(s.x) || !Number.isInteger(s.y)) return false;
  if (s.x < 0 || s.y < 0 || s.x >= map.width || s.y >= map.height) return false;
  if (!Array.isArray(s.party) || s.party.length > 6) return false;
  return s.party.every((m) => SPECIES[m.species] && Number.isFinite(m.level) && Number.isFinite(m.hp) && Array.isArray(m.moves));
}
