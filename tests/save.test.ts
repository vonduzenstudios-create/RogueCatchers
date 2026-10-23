import { describe, expect, it } from 'vitest';
import { createMonster } from '../src/battle/monster';
import { newGameState } from '../src/state/GameState';
import { type SaveStore, deleteSave, loadGame, saveGame } from '../src/state/save';

function memoryStore(): SaveStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('save games', () => {
  it('round-trips the whole game state', () => {
    const store = memoryStore();
    const s = newGameState();
    s.party.push(createMonster('sproutle', 7));
    s.coins = 123;
    s.flags.gotStarter = true;
    s.stats.seen.push('zapkit');
    expect(saveGame(s, store)).toBe(true);
    expect(loadGame(store)).toEqual(s);
  });

  it('returns null with no save, after deleting, or for junk', () => {
    const store = memoryStore();
    expect(loadGame(store)).toBeNull();
    saveGame(newGameState(), store);
    deleteSave(store);
    expect(loadGame(store)).toBeNull();
    store.setItem('roguecatchers.save', '{not json');
    expect(loadGame(store)).toBeNull();
  });

  it('rejects saves that point off the map or hold unknown monsters', () => {
    const store = memoryStore();
    const s = newGameState();
    s.x = 999;
    saveGame(s, store);
    expect(loadGame(store)).toBeNull();
    const t = newGameState();
    t.party.push({ ...createMonster('embrit', 5), species: 'missingno' as never });
    saveGame(t, store);
    expect(loadGame(store)).toBeNull();
  });

  it('fills in fields that older saves did not have', () => {
    const store = memoryStore();
    const old = newGameState() as Partial<ReturnType<typeof newGameState>>;
    delete old.stats;
    store.setItem('roguecatchers.save', JSON.stringify({ version: 1, savedAt: 0, state: old }));
    expect(loadGame(store)?.stats).toEqual(newGameState().stats);
  });

  it('reports failure when storage is full', () => {
    const store = memoryStore();
    store.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    expect(saveGame(newGameState(), store)).toBe(false);
  });
});
