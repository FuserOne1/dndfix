import { Character } from '../types';
import { getClassDefinition, getLineage, getOrigin } from './catalog';
import { createStartingInventory, equippedItemNames } from './inventory';
import { AttributeKey, BackstoryData, CharacterRulesData, ChoiceResolution, StoryChoice } from './types';

export type AttributeScores = Record<AttributeKey, number>;

export const BASE_SCORES: AttributeScores = {
  strength: 8,
  dexterity: 8,
  constitution: 8,
  intelligence: 8,
  wisdom: 8,
  charisma: 8,
};

export const POINT_BUY_BUDGET = 27;
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export function pointBuyCost(scores: AttributeScores): number {
  return Object.values(scores).reduce((sum, score) => sum + (POINT_COST[score] ?? 999), 0);
}

export function attributeModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}

export function applyLineageBonuses(scores: AttributeScores, lineageId: string): AttributeScores {
  const lineage = getLineage(lineageId);
  return Object.fromEntries(
    Object.entries(scores).map(([key, score]) => [key, score + (lineage.attributeBonuses[key as AttributeKey] || 0)]),
  ) as AttributeScores;
}

export function calculateMaxHp(classId: string, constitution: number, level = 1): number {
  const definition = getClassDefinition(classId);
  return Math.max(1, definition.hitDie + attributeModifier(constitution) + (level - 1) * (Math.ceil(definition.hitDie / 2) + 1 + attributeModifier(constitution)));
}

export function buildCharacterDraft(input: {
  name: string;
  lineageId: string;
  classId: string;
  originId: string;
  scores: AttributeScores;
  skills: string[];
  backstory: BackstoryData;
  avatarIcon: string;
}): Omit<Character, 'id' | 'created_at' | 'updated_at'> {
  const lineage = getLineage(input.lineageId);
  const classDefinition = getClassDefinition(input.classId);
  const origin = getOrigin(input.originId);
  const finalScores = applyLineageBonuses(input.scores, input.lineageId);
  const hp = calculateMaxHp(input.classId, finalScores.constitution);
  const rulesData: CharacterRulesData = {
    rulesVersion: 1,
    lineageId: lineage.id,
    classId: classDefinition.id,
    originId: origin.id,
    selectedSkills: [...new Set([...origin.skills, ...input.skills])],
    traits: [...lineage.traits, ...classDefinition.traits].map(trait => trait.id),
    storyTags: [...new Set([...lineage.storyTags, ...classDefinition.storyTags, ...origin.storyTags])],
  };
  const inventoryData = createStartingInventory([...new Set([...classDefinition.startingEquipment, ...origin.equipment])]);

  return {
    name: input.name.trim(),
    race: lineage.name,
    class: classDefinition.name,
    level: 1,
    hp_current: hp,
    hp_max: hp,
    xp: 0,
    strength: finalScores.strength,
    dexterity: finalScores.dexterity,
    constitution: finalScores.constitution,
    intelligence: finalScores.intelligence,
    wisdom: finalScores.wisdom,
    charisma: finalScores.charisma,
    background: origin.name,
    equipment: equippedItemNames(inventoryData),
    inventory_data: inventoryData,
    story_summary: input.backstory.prose,
    avatar_icon: input.avatarIcon,
    gold: origin.gold,
    rules_data: rulesData,
    backstory_data: input.backstory,
  };
}

export function getCharacterAttribute(character: Character, attribute: AttributeKey): number {
  return character[attribute];
}

export function isChoiceAvailable(choice: StoryChoice, character: Character, flags: string[], inventory: string[]): { available: boolean; reason?: string } {
  const requirements = choice.requirements;
  if (!requirements) return { available: true };
  const rules = character.rules_data;
  if (requirements.classIds?.length && (!rules || !requirements.classIds.includes(rules.classId))) return { available: false, reason: 'Требуется другой путь героя' };
  if (requirements.lineageIds?.length && (!rules || !requirements.lineageIds.includes(rules.lineageId))) return { available: false, reason: 'Недоступно вашему наследию' };
  if (requirements.items?.some(item => !inventory.includes(item))) return { available: false, reason: `Требуется: ${requirements.items.find(item => !inventory.includes(item))}` };
  if (requirements.flags?.some(flag => !flags.includes(flag))) return { available: false, reason: 'Не выполнено сюжетное условие' };
  if (requirements.minAttribute) {
    const failed = Object.entries(requirements.minAttribute).find(([key, value]) => getCharacterAttribute(character, key as AttributeKey) < (value || 0));
    if (failed) return { available: false, reason: `Недостаточно: ${failed[0]}` };
  }
  return { available: true };
}

export function resolveChoice(choice: StoryChoice, character: Character): ChoiceResolution {
  if (!choice.check) {
    return {
      choiceId: choice.id,
      success: true,
      summary: 'Выбор принят без проверки.',
      gainedItems: choice.consequences.grantItems || [],
      lostItems: choice.consequences.removeItems || [],
      hpChange: choice.consequences.hpChange || 0,
    };
  }

  const roll = Math.floor(Math.random() * 20) + 1;
  const modifier = attributeModifier(getCharacterAttribute(character, choice.check.attribute));
  const trained = choice.check.skill && character.rules_data?.selectedSkills.includes(choice.check.skill) ? proficiencyBonus(character.level) : 0;
  const total = roll + modifier + trained;
  const success = roll === 20 || (roll !== 1 && total >= choice.check.difficulty);
  return {
    choiceId: choice.id,
    success,
    roll,
    total,
    difficulty: choice.check.difficulty,
    summary: success ? 'Проверка пройдена.' : 'Проверка провалена.',
    gainedItems: success ? choice.consequences.grantItems || [] : [],
    lostItems: choice.consequences.removeItems || [],
    hpChange: choice.consequences.hpChange || 0,
  };
}
