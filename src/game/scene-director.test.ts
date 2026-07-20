import { describe, expect, it } from 'vitest';
import { Character } from '../types';
import { CampaignBible, CampaignPreferences, CampaignState, StoryScene } from './types';
import { buildScenePlan, chooseNextBlueprint, normalizeSceneType, servicesForScene } from './scene-director';
import { compactBibleForScene } from './campaign-generator';

const characters = [
  { id: 'hero-1', name: 'Эйра', hp_current: 10, hp_max: 10 },
  { id: 'hero-2', name: 'Бран', hp_current: 12, hp_max: 12 },
] as Character[];

const bible: CampaignBible = {
  title: 'Тест', tagline: '', premise: 'Путь', setting: 'Предел', tone: ['mystery'], centralConflict: 'Остановить бурю',
  antagonist: { name: 'Враг', role: 'регент', motive: 'власть' }, keyNpcs: [], truths: [], endings: [], characterHooks: [
    { characterName: 'Эйра', hook: 'найти пропавшего брата' }, { characterName: 'Бран', hook: 'вернуть честь рода' },
  ],
  acts: [
    { id: 'act-1', title: 'След', goal: 'Найти след', turningPoint: 'След ведёт вниз', sceneSeeds: ['Ворота', 'Карта'] },
    { id: 'act-2', title: 'Глубина', goal: 'Спуститься', turningPoint: 'Предательство', sceneSeeds: ['Мост', 'Храм'] },
    { id: 'act-3', title: 'Буря', goal: 'Остановить бурю', turningPoint: 'Последняя цена', sceneSeeds: ['Башня'] },
  ],
};

const preferences: CampaignPreferences = {
  mode: 'party', length: 'medium', tones: ['mystery'], setting: '', premise: '', combatFrequency: 'balanced',
  difficulty: 'normal', branching: 'balanced', themes: '', boundaries: '', customWish: '', hideLockedChoices: false, voteTimerSeconds: null,
};

function previousScene(type: StoryScene['type'] = 'narrative'): StoryScene {
  return { id: 'scene-1', actId: 'act-1', title: '', location: '', body: [''], type, choices: [] };
}

function state(sceneNumber: number): CampaignState {
  return {
    flags: [], inventory: [], relationships: {}, completedSceneIds: [], currentActId: 'act-1', currentSceneId: 'scene-1', sceneNumber,
    director: { completedBlueprintIds: [], recentTypes: [], scenesSinceCombat: 4, scenesSinceRest: 4, scenesSinceTrade: 4, personalSceneCounts: {} },
  };
}

describe('scene director', () => {
  it('builds a finite campaign with a controlled ending and no adjacent combats', () => {
    const plan = buildScenePlan(bible, preferences, characters);
    expect(plan).toHaveLength(20);
    expect(plan[0].type).toBe('narrative');
    expect(plan.at(-2)?.type).toBe('climax');
    expect(plan.at(-1)?.type).toBe('ending');
    expect(plan.some(scene => scene.type === 'trade')).toBe(true);
    expect(plan.some(scene => scene.type === 'rest')).toBe(true);
    expect(plan.slice(0, plan.findIndex(scene => scene.type === 'trade')).some(scene => scene.type === 'loot')).toBe(true);
    expect(plan.some(scene => scene.type === 'personal' && scene.focusCharacter === 'Эйра')).toBe(true);
    expect(plan.some(scene => scene.type === 'personal' && scene.focusCharacter === 'Бран')).toBe(true);
    expect(plan.find(scene => scene.type === 'personal' && scene.focusCharacter === 'Эйра')?.purpose).toContain('пропавшего брата');
    expect(plan.some((scene, index) => scene.type === 'combat' && plan[index - 1]?.type === 'combat')).toBe(false);
  });

  it('uses campaign length and combat frequency as real pacing rules', () => {
    const short = buildScenePlan(bible, { ...preferences, length: 'short' }, characters);
    const long = buildScenePlan(bible, { ...preferences, length: 'long' }, characters);
    expect(short).toHaveLength(12);
    expect(long).toHaveLength(32);

    const counts = (['rare', 'balanced', 'frequent'] as const).map(combatFrequency =>
      buildScenePlan(bible, { ...preferences, combatFrequency }, characters).filter(scene => scene.type === 'combat').length,
    );
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
  });

  it('normalizes legacy scenes and only exposes services in matching scene types', () => {
    expect(normalizeSceneType('group')).toBe('narrative');
    expect(normalizeSceneType('check')).toBe('challenge');
    expect(normalizeSceneType('battle')).toBe('combat');
    expect(servicesForScene('trade')).toEqual({ trade: true, rest: false, stash: true });
    expect(servicesForScene('narrative').trade).toBe(false);
    expect(servicesForScene('camp').rest).toBe(true);
  });

  it('does not send the full technical scene plan back to the prose model', () => {
    const scenePlan = buildScenePlan(bible, preferences, characters);
    const compact = compactBibleForScene({ ...bible, scenePlan });
    expect(compact).not.toHaveProperty('scenePlan');
    expect(compact.acts).toEqual(bible.acts);
    expect(compact.centralConflict).toBe(bible.centralConflict);
  });

  it('prevents consecutive battles even if the plan requests one', () => {
    const plan = buildScenePlan(bible, { ...preferences, combatFrequency: 'frequent' }, characters);
    const combatIndex = plan.findIndex(scene => scene.type === 'combat');
    const result = chooseNextBlueprint({
      bible: { ...bible, scenePlan: plan }, preferences, state: state(combatIndex + 1), previousScene: previousScene('battle'), characters,
    });
    expect(result.type).toBe('camp');
    expect(result.services.rest).toBe(true);
  });

  it('inserts recovery when the party is badly wounded', () => {
    const plan = buildScenePlan(bible, preferences, characters);
    const safeIndex = plan.findIndex((scene, index) => index > 1 && !['combat', 'climax', 'ending'].includes(scene.type));
    const wounded = characters.map(character => ({ ...character, hp_current: 1 }));
    const result = chooseNextBlueprint({
      bible: { ...bible, scenePlan: plan }, preferences, state: state(safeIndex + 1), previousScene: previousScene(), characters: wounded,
    });
    expect(result.type).toBe('rest');
    expect(result.purpose).toContain('Восстановление');
  });
});
