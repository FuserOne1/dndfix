import type { Character } from '../types';
import { calculateMaxHp } from './rules';
import { normalizeSceneType } from './scene-director';
import type { ChoiceResolution, StoryScene } from './types';

const XP_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

export function xpForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel <= XP_THRESHOLDS.length) return XP_THRESHOLDS[safeLevel - 1];
  const extraLevels = safeLevel - XP_THRESHOLDS.length;
  return XP_THRESHOLDS[XP_THRESHOLDS.length - 1] + extraLevels * 1000;
}

export function levelForXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (safeXp >= xpForLevel(level + 1) && level < 20) level += 1;
  return level;
}

export function experienceForScene(scene: StoryScene, resolution: ChoiceResolution): number {
  const type = normalizeSceneType(scene.type);
  if (type === 'combat') return 0;
  const baseByType: Record<string, number> = {
    narrative: 10, social: 12, travel: 10, camp: 8, rest: 6, trade: 6,
    exploration: 16, investigation: 18, challenge: 18, personal: 20,
    discovery: 22, loot: 12, climax: 30, ending: 30,
  };
  const tensionBonus = Math.max(0, (scene.tension || 1) - 1) * 2;
  const checkBonus = resolution.roll == null ? 0 : resolution.success ? 6 : 3;
  return (baseByType[type] || 10) + tensionBonus + checkBonus;
}

export interface ExperienceResult {
  character: Character;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
}

export function applyExperience(character: Character, amount: number): ExperienceResult {
  const xpGained = Math.max(0, Math.floor(amount));
  const nextXp = Math.max(0, character.xp || 0) + xpGained;
  const levelBefore = Math.max(1, character.level || levelForXp(character.xp || 0));
  const levelAfter = Math.max(levelBefore, levelForXp(nextXp));
  let hpMax = character.hp_max;
  if (levelAfter > levelBefore) {
    hpMax = character.rules_data?.classId
      ? calculateMaxHp(character.rules_data.classId, character.constitution, levelAfter)
      : character.hp_max + (levelAfter - levelBefore) * Math.max(1, 6 + Math.floor((character.constitution - 10) / 2));
  }
  const hpIncrease = Math.max(0, hpMax - character.hp_max);
  return {
    character: { ...character, xp: nextXp, level: levelAfter, hp_max: hpMax, hp_current: Math.min(hpMax, character.hp_current + hpIncrease) },
    xpGained,
    levelBefore,
    levelAfter,
  };
}

