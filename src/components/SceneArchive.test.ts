import { describe, expect, it } from 'vitest';
import type { StoryScene } from '../game/types';
import { mergeArchiveScenes } from './SceneArchive';

function scene(id: string, title: string): StoryScene {
  return { id, actId: 'act-1', title, location: 'Город', body: [`Текст ${title}`], type: 'narrative', choices: [] };
}

describe('scene archive', () => {
  it('sorts saved scenes and adds the unsaved current scene once', () => {
    const first = scene('scene-1', 'Начало');
    const current = scene('scene-3', 'Продолжение');
    const rows = [
      { scene_id: 'scene-2', act_id: 'act-1', scene_number: 2, content: scene('scene-2', 'След') },
      { scene_id: 'scene-1', act_id: 'act-1', scene_number: 1, content: first },
    ];
    const merged = mergeArchiveScenes(rows, current, 3);
    expect(merged.map(row => row.scene_number)).toEqual([1, 2, 3]);
    expect(merged.at(-1)?.content.title).toBe('Продолжение');
  });

  it('does not duplicate a current scene already saved in the database', () => {
    const current = scene('scene-2', 'Текущая');
    const merged = mergeArchiveScenes([{ scene_id: current.id, act_id: current.actId, scene_number: 2, content: current }], current, 2);
    expect(merged).toHaveLength(1);
  });
});
