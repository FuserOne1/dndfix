import { Character } from '../types';
import {
  CampaignBible,
  CampaignPreferences,
  CampaignState,
  SceneBlueprint,
  SceneDirectorState,
  SceneServices,
  SceneType,
  StoryScene,
} from './types';

const LENGTH_SCENES = { short: 12, medium: 20, long: 32 } as const;
const COMBAT_INTERVAL = { rare: 7, balanced: 5, frequent: 3 } as const;
const BASE_SEQUENCE: SceneType[] = [
  'narrative', 'exploration', 'social', 'investigation', 'challenge', 'discovery',
  'travel', 'personal', 'loot', 'camp', 'trade', 'rest',
];

export function normalizeSceneType(type: StoryScene['type'] | string | undefined): SceneType {
  if (type === 'group') return 'narrative';
  if (type === 'check') return 'challenge';
  if (type === 'battle') return 'combat';
  if (BASE_SEQUENCE.includes(type as SceneType) || ['combat', 'climax', 'ending'].includes(type || '')) return type as SceneType;
  return 'narrative';
}

export function servicesForScene(type: SceneType): SceneServices {
  return {
    trade: type === 'trade',
    rest: type === 'rest' || type === 'camp',
    stash: type === 'trade' || type === 'rest' || type === 'camp',
  };
}

export function buildScenePlan(bible: CampaignBible, preferences: CampaignPreferences, characters: Character[]): SceneBlueprint[] {
  const total = LENGTH_SCENES[preferences.length];
  const acts = bible.acts.length ? bible.acts : [{ id: 'act-1', title: '', goal: bible.centralConflict, turningPoint: '', sceneSeeds: [] }];
  const interval = COMBAT_INTERVAL[preferences.combatFrequency];
  let personalIndex = 0;

  const plan: SceneBlueprint[] = [];
  for (let index = 0; index < total; index += 1) {
    const actIndex = Math.min(acts.length - 1, Math.floor(index * acts.length / total));
    const act = acts[actIndex];
    const actStart = Math.floor(actIndex * total / acts.length);
    const localIndex = index - actStart;
    let type = BASE_SEQUENCE[index % BASE_SEQUENCE.length];

    if (index === 0) type = 'narrative';
    else if (index === total - 1) type = 'ending';
    else if (index === total - 2) type = 'climax';
    else if (index % interval === interval - 1) type = 'combat';

    const previousType = index > 0 ? plan[index - 1]?.type : undefined;
    if (type === 'combat' && previousType === 'combat') type = 'challenge';

    const focusCharacter = type === 'personal' && characters.length
      ? characters[personalIndex++ % characters.length].name
      : undefined;
    const audience = characters.length === 1 ? 'solo' : type === 'personal' ? 'personal' : 'group';
    const seed = act.sceneSeeds?.[localIndex % Math.max(1, act.sceneSeeds.length)];
    const personalHook = focusCharacter ? bible.characterHooks.find(hook => hook.characterName === focusCharacter)?.hook : undefined;
    const purpose = type === 'personal' && personalHook
      ? `Поставить героя ${focusCharacter} перед его личным конфликтом: ${personalHook}`
      : type === 'trade'
        ? `Познакомить героев с торговцем, дать купить, продать и узнать местные слухи: ${seed || act.goal}`
        : type === 'loot'
          ? `Дать героям заслуженную материальную награду и связать её с сюжетом: ${seed || act.goal}`
          : seed || (type === 'climax' ? act.turningPoint : type === 'ending' ? bible.centralConflict : act.goal);
    const actProgress = (localIndex + 1) / Math.max(1, Math.ceil(total / acts.length));
    const tension = Math.max(1, Math.min(5, type === 'ending' ? 3 : type === 'climax' ? 5 : type === 'combat' ? 4 : Math.ceil(actProgress * 4))) as 1 | 2 | 3 | 4 | 5;

    plan.push({
      id: `blueprint-${index + 1}`,
      actId: act.id,
      type,
      purpose,
      tension,
      audience,
      focusCharacter,
      services: servicesForScene(type),
    });
  }

  ensureUtilityScene(plan, 'trade', Math.max(2, Math.floor(total * 0.35)));
  ensureUtilityScene(plan, 'rest', Math.max(3, Math.floor(total * 0.55)));
  ensureLootBeforeTrade(plan);
  if (characters.length) ensurePersonalCoverage(plan, characters, bible);
  return plan.map((blueprint, index) => ({ ...blueprint, id: `blueprint-${index + 1}`, services: servicesForScene(blueprint.type) }));
}

function ensureLootBeforeTrade(plan: SceneBlueprint[]) {
  const tradeIndex = plan.findIndex(scene => scene.type === 'trade');
  if (tradeIndex <= 1 || plan.slice(0, tradeIndex).some(scene => scene.type === 'loot')) return;
  const index = tradeIndex - 1;
  if (['combat', 'climax', 'ending'].includes(plan[index].type)) return;
  plan[index] = { ...plan[index], type: 'loot', purpose: 'Дать героям первые деньги или полезную добычу перед встречей с торговцем' };
}

function ensureUtilityScene(plan: SceneBlueprint[], type: 'trade' | 'rest', preferredIndex: number) {
  if (plan.some(scene => scene.type === type)) return;
  const index = Math.min(plan.length - 3, preferredIndex);
  plan[index] = { ...plan[index], type, purpose: type === 'trade' ? 'Пополнить припасы и получить местные сведения' : 'Дать героям восстановиться и осмыслить последствия' };
}

function ensurePersonalCoverage(plan: SceneBlueprint[], characters: Character[], bible: CampaignBible) {
  const usable = plan.map((_, index) => index).filter(index => index > 1 && index < plan.length - 2 && !['combat', 'trade', 'rest', 'loot'].includes(plan[index].type));
  characters.forEach((character, characterIndex) => {
    if (plan.some(scene => scene.type === 'personal' && scene.focusCharacter === character.name)) return;
    const index = usable[Math.floor((characterIndex + 1) * usable.length / (characters.length + 1))];
    if (index === undefined) return;
    const hook = bible.characterHooks.find(item => item.characterName === character.name)?.hook || 'его прошлое требует решения';
    plan[index] = {
      ...plan[index], type: 'personal', audience: characters.length === 1 ? 'solo' : 'personal',
      focusCharacter: character.name,
      purpose: `Поставить героя ${character.name} перед его личным конфликтом: ${hook}`,
    };
  });
}

export function ensureScenePlan(bible: CampaignBible, preferences: CampaignPreferences, characters: Character[]): CampaignBible {
  if (bible.scenePlan?.length) return bible;
  return { ...bible, scenePlan: buildScenePlan(bible, preferences, characters) };
}

export function chooseNextBlueprint(input: {
  bible: CampaignBible;
  preferences: CampaignPreferences;
  state: CampaignState;
  previousScene: StoryScene;
  characters: Character[];
}): SceneBlueprint {
  const plan = input.bible.scenePlan?.length ? input.bible.scenePlan : buildScenePlan(input.bible, input.preferences, input.characters);
  const index = Math.max(0, Math.min(plan.length - 1, input.state.sceneNumber - 1));
  let blueprint = { ...plan[index], services: { ...plan[index].services } };
  if (blueprint.type === 'personal' && blueprint.focusCharacter) {
    const hook = input.bible.characterHooks.find(item => item.characterName === blueprint.focusCharacter)?.hook;
    if (hook) blueprint.purpose = `Поставить героя ${blueprint.focusCharacter} перед его личным конфликтом: ${hook}`;
  }
  if (blueprint.type === 'trade') blueprint.purpose = `Явно познакомить героев с торговцем, дать купить и продать вещи, а также получить сюжетный слух: ${blueprint.purpose}`;
  if (blueprint.type === 'loot') blueprint.purpose = `Дать героям золото или полезную добычу как результат их действий: ${blueprint.purpose}`;
  const previousType = normalizeSceneType(input.previousScene.type);
  const director = input.state.director;
  const partyNeedsRest = input.characters.some(character => character.hp_max > 0 && character.hp_current / character.hp_max <= 0.35);

  if (blueprint.type === 'combat' && previousType === 'combat') {
    blueprint = adaptBlueprint(blueprint, 'camp', 'Передышка после боя и разбор его последствий');
  } else if (partyNeedsRest && (director?.scenesSinceRest ?? 3) >= 3 && !['combat', 'climax', 'ending'].includes(blueprint.type)) {
    blueprint = adaptBlueprint(blueprint, 'rest', 'Восстановление израненной группы перед продолжением пути');
  }
  if (blueprint.type === 'ending' && index < plan.length - 1) blueprint = adaptBlueprint(blueprint, 'narrative', blueprint.purpose);
  return blueprint;
}

function adaptBlueprint(blueprint: SceneBlueprint, type: SceneType, purpose: string): SceneBlueprint {
  return { ...blueprint, type, purpose, services: servicesForScene(type) };
}

export function createDirectorState(scene: StoryScene, characters: Character[]): SceneDirectorState {
  return {
    currentBlueprintId: scene.blueprintId,
    completedBlueprintIds: [],
    recentTypes: [],
    scenesSinceCombat: 0,
    scenesSinceRest: 0,
    scenesSinceTrade: 0,
    personalSceneCounts: Object.fromEntries(characters.map(character => [character.name, 0])),
  };
}

export function recordCompletedScene(state: SceneDirectorState | undefined, scene: StoryScene, characters: Character[]): SceneDirectorState {
  const current = state || createDirectorState(scene, characters);
  const type = normalizeSceneType(scene.type);
  const personalSceneCounts = { ...current.personalSceneCounts };
  if (type === 'personal' && scene.focusCharacter) personalSceneCounts[scene.focusCharacter] = (personalSceneCounts[scene.focusCharacter] || 0) + 1;
  return {
    currentBlueprintId: undefined,
    completedBlueprintIds: scene.blueprintId && !current.completedBlueprintIds.includes(scene.blueprintId)
      ? [...current.completedBlueprintIds, scene.blueprintId]
      : current.completedBlueprintIds,
    recentTypes: [...current.recentTypes.filter((_, index, all) => index >= all.length - 3), type],
    scenesSinceCombat: type === 'combat' ? 0 : current.scenesSinceCombat + 1,
    scenesSinceRest: type === 'rest' || type === 'camp' ? 0 : current.scenesSinceRest + 1,
    scenesSinceTrade: type === 'trade' ? 0 : current.scenesSinceTrade + 1,
    personalSceneCounts,
  };
}

export function enterScene(state: SceneDirectorState, scene: StoryScene): SceneDirectorState {
  return { ...state, currentBlueprintId: scene.blueprintId };
}

export function applyBlueprint(scene: StoryScene, blueprint: SceneBlueprint): StoryScene {
  return {
    ...scene,
    actId: blueprint.actId,
    type: blueprint.type,
    audience: blueprint.audience,
    purpose: blueprint.purpose,
    tension: blueprint.tension,
    services: blueprint.services,
    blueprintId: blueprint.id,
    focusCharacter: blueprint.focusCharacter,
  };
}
