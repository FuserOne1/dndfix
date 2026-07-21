import { describe, expect, it } from 'vitest';
import { groupTimelines, identifyEnding, savepointLabel, storyIdOf } from './timelines';
import { CampaignRuntime } from './types';

function runtime(overrides: Partial<CampaignRuntime> = {}): CampaignRuntime {
  return {
    id: 'run-1', mode: 'solo', status: 'playing', hostUserId: 'user', preferences: {} as CampaignRuntime['preferences'],
    bible: { title: 'Башня', tagline: '', premise: '', setting: '', tone: [], centralConflict: '', antagonist: { name: '', role: '', motive: '' }, keyNpcs: [], acts: [{ id: 'a1', title: 'Пробуждение', goal: '', turningPoint: '', sceneSeeds: [] }], truths: [], endings: [{ id: 'light', title: 'Последний рассвет', condition: '' }, { id: 'dark', title: 'Корона пепла', condition: '' }], characterHooks: [] },
    state: { flags: [], inventory: [], relationships: {}, completedSceneIds: [], currentActId: 'a1', currentSceneId: 's1', sceneNumber: 3 },
    currentScene: { id: 's1', actId: 'a1', title: 'Перед бурей', location: '', body: [], type: 'narrative', choices: [] },
    ...overrides,
  };
}

describe('story timelines', () => {
  it('keeps legacy campaigns grouped under their own id', () => {
    expect(storyIdOf(runtime())).toBe('run-1');
    const grouped = groupTimelines([runtime(), runtime({ id: 'run-2', storyId: 'run-1', timelineNumber: 2 })]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].timelines[0].id).toBe('run-2');
  });

  it('matches a generated ending to the authored ending list', () => {
    const campaign = runtime();
    expect(identifyEnding(campaign.bible, { ...campaign.currentScene, id: 'final', title: 'Последний рассвет', type: 'ending' })).toEqual({ id: 'light', title: 'Последний рассвет' });
  });

  it('makes a readable automatic branch label', () => {
    expect(savepointLabel(runtime())).toBe('Пробуждение · перед сценой 3');
  });
});
