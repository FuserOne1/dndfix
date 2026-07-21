import { describe, expect, it } from 'vitest';
import { applyWorldPatch, mergeWorldPatches, relationshipStatus, sanitizeWorldPatch, stableKey } from './world-state';

describe('world state engine', () => {
  it('applies bounded relationship changes and records their source', () => {
    const state = applyWorldPatch(undefined, { relationships: [{ targetName: 'Мара Вей', reason: 'Спасли брата', trust: 500, fear: -3 }] }, 'scene-4', 4);
    expect(state.relationships[0]).toMatchObject({ targetKey: 'мара-вей', trust: 25, fear: -3, updatedSceneId: 'scene-4' });
  });
  it('adds and removes conditions by stable identity', () => {
    const added = applyWorldPatch(undefined, { conditions: [{ action: 'add', characterId: 'hero', key: 'poisoned', name: 'Отравлен', description: 'Яд', severity: 'major', durationScenes: 2 }] }, 'scene-2', 2);
    expect(added.conditions[0].expiresAtScene).toBe(4);
    const removed = applyWorldPatch(added, { conditions: [{ action: 'remove', characterId: 'hero', key: 'poisoned', name: 'Отравлен', description: '', severity: 'major' }] }, 'scene-3', 3);
    expect(removed.conditions).toHaveLength(0);
  });
  it('deduplicates clues and merges patch categories', () => {
    const patch = mergeWorldPatches({ clues: [{ key: 'letter', title: 'Письмо', description: 'Текст' }] }, { locations: [{ key: 'dock', name: 'Пристань' }] });
    const once = applyWorldPatch(undefined, patch, 'scene-1', 1);
    const twice = applyWorldPatch(once, patch, 'scene-2', 2);
    expect(twice.clues).toHaveLength(1);
    expect(twice.locations).toHaveLength(1);
  });
  it('provides readable status labels and stable unicode keys', () => {
    expect(relationshipStatus(35)).toBe('доверяет');
    expect(stableKey(' Старая пристань ')).toBe('старая-пристань');
  });
  it('rejects hallucinated NPCs, unknown characters and impossible routes', () => {
    const patch = sanitizeWorldPatch({
      relationships: [{ targetName: 'Несуществующий король', reason: 'Выдуман', trust: 10 }],
      conditions: [{ action: 'add', characterId: 'ghost', key: 'curse', name: 'Проклятие', description: '', severity: 'major' }],
      routes: [{ fromKey: 'void', toKey: 'nowhere' }],
    }, {
      bible: { title: 'T', tagline: '', premise: '', setting: '', tone: [], centralConflict: '', antagonist: { name: 'Враг', role: '', motive: '' }, keyNpcs: [{ id: 'mara', name: 'Мара', role: '', motive: '', secret: '' }], acts: [], truths: [], endings: [], characterHooks: [] },
      characters: [{ id: 'hero' } as any],
      scene: { id: 's', actId: 'a', title: 'Сцена', location: 'Место', body: [], type: 'narrative', choices: [] },
    });
    expect(patch.relationships).toEqual([]);
    expect(patch.conditions).toEqual([]);
    expect(patch.routes).toEqual([]);
  });
});
