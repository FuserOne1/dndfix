import type { Character } from '../types';
import type { CampaignBible, CampaignLocation, CampaignSystemsState, SceneServices, StoryChoice, StoryScene, WorldStatePatch } from './types';

const NO_SERVICES: SceneServices = { trade: false, rest: false, stash: false };

export function createInitialSystems(bible: CampaignBible, opening: StoryScene, characters: Character[]): CampaignSystemsState {
  const location = locationFromScene(opening);
  return {
    relationships: [
      ...bible.keyNpcs.map(npc => ({ targetKey: npc.id || stableKey(npc.name), targetName: npc.name, targetType: 'npc' as const, trust: 0, respect: 0, fear: 0, affection: 0, reason: 'Отношения ещё не сформированы.' })),
      { targetKey: 'main-antagonist', targetName: bible.antagonist.name, targetType: 'npc' as const, trust: -10, respect: 0, fear: 5, affection: -10, reason: bible.antagonist.role },
    ].filter((relationship, index, all) => all.findIndex(item => item.targetKey === relationship.targetKey) === index),
    conditions: [],
    locations: [location],
    routes: [],
    quests: [{ key: `act:${bible.acts[0]?.id || 'act-1'}`, title: bible.acts[0]?.title || 'Начало пути', description: bible.acts[0]?.goal || bible.centralConflict, status: 'active', stage: opening.recap || 'Разобраться в происходящем', relatedLocationKey: location.key, updatedSceneId: opening.id }],
    clues: [],
  };
}

export function emptySystems(): CampaignSystemsState {
  return { relationships: [], conditions: [], locations: [], routes: [], quests: [], clues: [] };
}

export function normalizeSystems(value?: CampaignSystemsState): CampaignSystemsState {
  return { ...emptySystems(), ...(value || {}), relationships: value?.relationships || [], conditions: value?.conditions || [], locations: value?.locations || [], routes: value?.routes || [], quests: value?.quests || [], clues: value?.clues || [] };
}

export function worldPatchForChoice(choice: StoryChoice, success: boolean): WorldStatePatch {
  const world = normalizePatch(choice.consequences.world);
  if (!success) {
    return {
      ...world,
      relationships: world.relationships?.map(change => ({ ...change, trust: invertPositive(change.trust), respect: invertPositive(change.respect), affection: invertPositive(change.affection), fear: change.fear === undefined ? undefined : Math.max(0, change.fear) })),
    };
  }
  return world;
}

export function sanitizeWorldPatch(patch: WorldStatePatch, context: { bible: CampaignBible; characters: Character[]; systems?: CampaignSystemsState; scene: StoryScene }): WorldStatePatch {
  const safe = normalizePatch(patch);
  const systems = normalizeSystems(context.systems);
  const knownNpcKeys = new Set([...context.bible.keyNpcs.map(npc => npc.id || stableKey(npc.name)), 'main-antagonist', ...systems.relationships.map(item => item.targetKey)]);
  const knownNpcNames = new Set([...context.bible.keyNpcs.map(npc => npc.name.toLocaleLowerCase('ru-RU')), context.bible.antagonist.name.toLocaleLowerCase('ru-RU'), ...systems.relationships.map(item => item.targetName.toLocaleLowerCase('ru-RU'))]);
  const characterIds = new Set(context.characters.map(character => character.id));
  const locations = new Set([...systems.locations.map(location => location.key), ...(safe.locations || []).map(location => location.key || stableKey(location.name))]);
  return {
    relationships: (safe.relationships || []).filter(change => change.targetType === 'faction' || knownNpcKeys.has(change.targetKey || '') || knownNpcNames.has(change.targetName.toLocaleLowerCase('ru-RU'))).map(change => ({ ...change, trust: safeDelta(change.trust), respect: safeDelta(change.respect), fear: safeDelta(change.fear), affection: safeDelta(change.affection), reason: change.reason?.trim() || `Последствие выбора в сцене «${context.scene.title}»` })),
    conditions: (safe.conditions || []).filter(change => characterIds.has(change.characterId) && Boolean(change.key && change.name)),
    locations: (safe.locations || []).filter(change => Boolean(change.key && change.name)),
    routes: (safe.routes || []).filter(change => locations.has(change.fromKey) && locations.has(change.toKey) && change.fromKey !== change.toKey),
    quests: (safe.quests || []).filter(change => Boolean(change.key && change.title)),
    clues: (safe.clues || []).filter(change => Boolean(change.key && change.title && change.description)),
  };
}

export function sceneEntryPatch(scene: StoryScene, previousLocation?: CampaignLocation): WorldStatePatch {
  const location = locationFromScene(scene);
  const locations: NonNullable<WorldStatePatch['locations']> = [location];
  const routes: NonNullable<WorldStatePatch['routes']> = [];
  if (previousLocation && previousLocation.key !== location.key) routes.push({ fromKey: previousLocation.key, toKey: location.key, key: routeKey(previousLocation.key, location.key), label: `${previousLocation.name} → ${location.name}`, danger: Math.max(previousLocation.danger, location.danger) as CampaignLocation['danger'], status: 'open' });
  return { locations, routes };
}

export function mergeWorldPatches(...patches: WorldStatePatch[]): WorldStatePatch {
  const normalized = patches.map(normalizePatch);
  return {
    relationships: normalized.flatMap(patch => patch.relationships || []),
    conditions: normalized.flatMap(patch => patch.conditions || []),
    locations: normalized.flatMap(patch => patch.locations || []),
    routes: normalized.flatMap(patch => patch.routes || []),
    quests: normalized.flatMap(patch => patch.quests || []),
    clues: normalized.flatMap(patch => patch.clues || []),
  };
}

export function applyWorldPatch(state: CampaignSystemsState | undefined, patch: WorldStatePatch, sceneId: string, sceneNumber: number): CampaignSystemsState {
  const next = structuredClone(normalizeSystems(state));
  for (const change of patch.relationships || []) {
    const key = change.targetKey || stableKey(change.targetName);
    const existing = next.relationships.find(item => item.targetKey === key);
    const base = existing || { targetKey: key, targetName: change.targetName, targetType: change.targetType || 'npc', trust: 0, respect: 0, fear: 0, affection: 0 };
    const updated = { ...base, targetName: change.targetName || base.targetName, targetType: change.targetType || base.targetType, trust: clamp(base.trust + safeDelta(change.trust)), respect: clamp(base.respect + safeDelta(change.respect)), fear: clamp(base.fear + safeDelta(change.fear)), affection: clamp(base.affection + safeDelta(change.affection)), reason: change.reason, updatedSceneId: sceneId };
    if (existing) Object.assign(existing, updated); else next.relationships.push(updated);
  }
  for (const change of patch.conditions || []) {
    const index = next.conditions.findIndex(item => item.characterId === change.characterId && item.key === change.key);
    if (change.action === 'remove') { if (index >= 0) next.conditions.splice(index, 1); continue; }
    const condition = { characterId: change.characterId, key: change.key, name: change.name, description: change.description, severity: change.severity, expiresAtScene: change.durationScenes ? sceneNumber + Math.max(1, change.durationScenes) : undefined, sourceSceneId: sceneId };
    if (index >= 0) next.conditions[index] = condition; else next.conditions.push(condition);
  }
  next.conditions = next.conditions.filter(condition => !condition.expiresAtScene || condition.expiresAtScene > sceneNumber);
  for (const change of patch.locations || []) {
    const key = change.key || stableKey(change.name);
    const existing = next.locations.find(item => item.key === key);
    const location: CampaignLocation = { key, name: change.name, description: change.description || existing?.description || '', status: change.status || existing?.status || 'discovered', danger: clampDanger(change.danger ?? existing?.danger ?? 1), services: change.services || existing?.services || NO_SERVICES, discoveredSceneId: existing?.discoveredSceneId || sceneId };
    if (existing) Object.assign(existing, location); else next.locations.push(location);
  }
  for (const change of patch.routes || []) {
    const key = change.key || routeKey(change.fromKey, change.toKey);
    const existing = next.routes.find(item => item.key === key);
    const route = { key, fromKey: change.fromKey, toKey: change.toKey, label: change.label || `${change.fromKey} → ${change.toKey}`, danger: clampDanger(change.danger ?? existing?.danger ?? 1), status: change.status || existing?.status || 'open' };
    if (existing) Object.assign(existing, route); else next.routes.push(route);
  }
  for (const change of patch.quests || []) {
    const existing = next.quests.find(item => item.key === change.key);
    const quest = { key: change.key, title: change.title, description: change.description || existing?.description || '', status: change.status || existing?.status || 'active', stage: change.stage || existing?.stage || 'Начато', relatedLocationKey: change.relatedLocationKey || existing?.relatedLocationKey, updatedSceneId: sceneId };
    if (existing) Object.assign(existing, quest); else next.quests.push(quest);
  }
  for (const change of patch.clues || []) {
    if (next.clues.some(item => item.key === change.key)) continue;
    next.clues.push({ key: change.key, title: change.title, description: change.description, relatedQuestKey: change.relatedQuestKey, reliability: change.reliability || 'uncertain', discoveredSceneId: sceneId });
  }
  return next;
}

export function currentLocation(systems: CampaignSystemsState | undefined, scene: StoryScene): CampaignLocation {
  const normalized = normalizeSystems(systems);
  return normalized.locations.find(location => location.key === stableKey(scene.location)) || locationFromScene(scene);
}

export function relationshipStatus(score: number): string {
  if (score >= 65) return 'предан';
  if (score >= 30) return 'доверяет';
  if (score >= 10) return 'расположен';
  if (score <= -65) return 'заклятый враг';
  if (score <= -30) return 'враждебен';
  if (score <= -10) return 'насторожен';
  return 'нейтрален';
}

export function stableKey(value: string): string { return value.trim().toLocaleLowerCase('ru-RU').replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || 'unknown'; }
function locationFromScene(scene: StoryScene): CampaignLocation { return { key: stableKey(scene.location), name: scene.location, description: scene.recap || scene.purpose || '', status: 'visited', danger: clampDanger(scene.tension || 1), services: scene.services || NO_SERVICES, discoveredSceneId: scene.id }; }
function routeKey(left: string, right: string): string { return `route:${[left, right].sort().join(':')}`; }
function safeDelta(value?: number): number { return Number.isFinite(value) ? Math.max(-25, Math.min(25, Math.trunc(value!))) : 0; }
function clamp(value: number): number { return Math.max(-100, Math.min(100, value)); }
function clampDanger(value: number): CampaignLocation['danger'] { return Math.max(0, Math.min(5, Math.trunc(value))) as CampaignLocation['danger']; }
function invertPositive(value?: number): number | undefined { return value === undefined ? undefined : value > 0 ? -value : value; }
function normalizePatch(value?: WorldStatePatch): WorldStatePatch {
  const patch = value && typeof value === 'object' ? value : {};
  return { relationships: Array.isArray(patch.relationships) ? patch.relationships : [], conditions: Array.isArray(patch.conditions) ? patch.conditions : [], locations: Array.isArray(patch.locations) ? patch.locations : [], routes: Array.isArray(patch.routes) ? patch.routes : [], quests: Array.isArray(patch.quests) ? patch.quests : [], clues: Array.isArray(patch.clues) ? patch.clues : [] };
}
