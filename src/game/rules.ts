import { Character } from '../types';
import { ATTRIBUTE_LABELS, SKILLS, getClassDefinition, getLineage, getOrigin } from './catalog';
import { createStartingInventory, equippedItemNames, inventoryItemNames, inventoryNamesHaveItem, normalizeInventory } from './inventory';
import { AttributeKey, BackstoryData, CampaignPreferences, CharacterRulesData, ChoiceCheck, ChoiceResolution, StoryChoice } from './types';

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

export const SKILL_ATTRIBUTES: Record<string, AttributeKey> = {
  'Атлетика': 'strength',
  'Акробатика': 'dexterity',
  'Скрытность': 'dexterity',
  'Ловкость рук': 'dexterity',
  'Знание': 'intelligence',
  'Расследование': 'intelligence',
  'Природа': 'intelligence',
  'Медицина': 'wisdom',
  'Проницательность': 'wisdom',
  'Внимание': 'wisdom',
  'Выживание': 'wisdom',
  'Убеждение': 'charisma',
  'Обман': 'charisma',
  'Запугивание': 'charisma',
  'Выступление': 'charisma',
};

export const DIFFICULTY_RANGES: Record<CampaignPreferences['difficulty'], { min: number; max: number; adjustment: number }> = {
  story: { min: 8, max: 13, adjustment: -2 },
  normal: { min: 10, max: 15, adjustment: 0 },
  dangerous: { min: 12, max: 18, adjustment: 2 },
};

export interface ChoiceCheckContext {
  difficulty?: CampaignPreferences['difficulty'];
  failureStreak?: number;
  rollD20?: () => number;
}

export interface ChoiceCheckPreview {
  attribute: AttributeKey;
  attributeLabel: string;
  modifier: number;
  skill?: string;
  proficiency: number;
  itemBonus: number;
  itemBonusLabel?: string;
  difficulty: number;
  advantageReason?: string;
  successChance: number;
}

export function normalizeChoiceCheck(check: ChoiceCheck, hint = ''): ChoiceCheck {
  const validSkill = check.skill && SKILLS.includes(check.skill) ? check.skill : inferSkill(check.attribute, hint);
  const skillAttribute = validSkill && SKILL_ATTRIBUTES[validSkill];
  return {
    ...check,
    attribute: skillAttribute || check.attribute,
    skill: validSkill,
    difficulty: Math.max(5, Math.min(25, Math.round(Number(check.difficulty) || 12))),
  };
}

function inferSkill(attribute: AttributeKey, hint: string): string | undefined {
  const text = hint.toLocaleLowerCase('ru');
  if (attribute === 'strength') return 'Атлетика';
  if (attribute === 'dexterity') {
    if (/скры|краст|тихо|незамет|тень/.test(text)) return 'Скрытность';
    if (/замок|отмыч|карман|украст|механизм/.test(text)) return 'Ловкость рук';
    return 'Акробатика';
  }
  if (attribute === 'intelligence') {
    if (/природ|растен|звер|яд|трава/.test(text)) return 'Природа';
    if (/знан|маг|рун|истор|книг|символ/.test(text)) return 'Знание';
    return 'Расследование';
  }
  if (attribute === 'wisdom') {
    if (/леч|ран|болез|медиц/.test(text)) return 'Медицина';
    if (/мотив|лож|намер|чувств|понять/.test(text)) return 'Проницательность';
    if (/след|путь|выжив|охот|лагер/.test(text)) return 'Выживание';
    return 'Внимание';
  }
  if (attribute === 'charisma') {
    if (/угрож|запуг|давлен/.test(text)) return 'Запугивание';
    if (/обман|совр|лож|выдать себя/.test(text)) return 'Обман';
    if (/выступ|песн|танц|публи/.test(text)) return 'Выступление';
    return 'Убеждение';
  }
  return undefined;
}

export function adjustedDifficulty(base: number, difficulty: CampaignPreferences['difficulty'] = 'normal'): number {
  const range = DIFFICULTY_RANGES[difficulty];
  return Math.max(range.min, Math.min(range.max, Math.round(base) + range.adjustment));
}

function storyItemBonus(character: Character, skill?: string): { value: number; label?: string } {
  if (!skill) return { value: 0 };
  const items = inventoryItemNames(normalizeInventory(character));
  const has = (pattern: RegExp) => items.find(item => pattern.test(item.toLocaleLowerCase('ru')));
  if (skill === 'Ловкость рук') {
    const item = has(/отмыч|инструмент.*взлом/);
    if (item) return { value: 2, label: item };
  }
  if (['Расследование', 'Ловкость рук'].includes(skill)) {
    const item = has(/инструмент.*ремес|набор.*механ/);
    if (item) return { value: 1, label: item };
  }
  if (skill === 'Атлетика' || skill === 'Акробатика') {
    const item = has(/вер[её]вк/);
    if (item) return { value: 1, label: item };
  }
  if (skill === 'Знание') {
    const item = has(/книга|дневник|кристалл/);
    if (item) return { value: 1, label: item };
  }
  return { value: 0 };
}

function traitAdvantage(character: Character, check: ChoiceCheck): string | undefined {
  const traits = new Set(character.rules_data?.traits || []);
  const skill = check.skill;
  if (traits.has('echo-sight') && ['Внимание', 'Расследование', 'Знание'].includes(skill || '')) return 'Эльфийское восприятие';
  if (traits.has('two-worlds') && ['Убеждение', 'Проницательность', 'Обман'].includes(skill || '')) return 'Меж двух миров';
  if (traits.has('deep-sight') && skill === 'Внимание') return 'Зрение глубин';
  if (traits.has('unyielding') && check.attribute === 'constitution') return 'Дворфийская стойкость';
  if (traits.has('bright-spark') && ['Расследование', 'Ловкость рук'].includes(skill || '')) return 'Искра изобретателя';
  if (traits.has('keen-senses') && ['Внимание', 'Выживание'].includes(skill || '')) return 'Чуткие чувства';
  if (traits.has('quarry') && skill === 'Выживание') return 'Добыча';
  return undefined;
}

export function previewChoiceCheck(choice: StoryChoice, character: Character, context: ChoiceCheckContext = {}): ChoiceCheckPreview | undefined {
  if (!choice.check) return undefined;
  const check = normalizeChoiceCheck(choice.check, `${choice.label} ${choice.description || ''} ${choice.intent}`);
  const modifier = attributeModifier(getCharacterAttribute(character, check.attribute));
  const proficiency = check.skill && character.rules_data?.selectedSkills.includes(check.skill) ? proficiencyBonus(character.level) : 0;
  const item = storyItemBonus(character, check.skill);
  const difficulty = adjustedDifficulty(check.difficulty, context.difficulty);
  const advantageReason = traitAdvantage(character, check) || ((context.failureStreak || 0) >= 2 ? 'Удача после серии неудач' : undefined);
  const successChance = calculateSuccessChance(difficulty, modifier + proficiency + item.value, Boolean(advantageReason));
  return { attribute: check.attribute, attributeLabel: ATTRIBUTE_LABELS[check.attribute], modifier, skill: check.skill, proficiency, itemBonus: item.value, itemBonusLabel: item.label, difficulty, advantageReason, successChance };
}

function calculateSuccessChance(difficulty: number, bonus: number, advantage: boolean): number {
  let successes = 0;
  const outcomes = advantage ? 400 : 20;
  for (let first = 1; first <= 20; first += 1) {
    const seconds = advantage ? Array.from({ length: 20 }, (_, index) => index + 1) : [first];
    for (const second of seconds) {
      const roll = Math.max(first, second);
      if (roll === 20 || (roll !== 1 && roll + bonus >= difficulty)) successes += 1;
    }
  }
  return Math.round((successes / outcomes) * 100);
}

export function secureD20(): number {
  if (!globalThis.crypto?.getRandomValues) return Math.floor(Math.random() * 20) + 1;
  const values = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / 20) * 20;
  do globalThis.crypto.getRandomValues(values); while (values[0] >= limit);
  return (values[0] % 20) + 1;
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
    rulesVersion: 2,
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
  if (requirements.items?.some(item => !inventoryNamesHaveItem(inventory, item))) return { available: false, reason: `Требуется: ${requirements.items.find(item => !inventoryNamesHaveItem(inventory, item))}` };
  if (requirements.flags?.some(flag => !flags.includes(flag))) return { available: false, reason: 'Не выполнено сюжетное условие' };
  if (requirements.minAttribute) {
    const failed = Object.entries(requirements.minAttribute).find(([key, value]) => getCharacterAttribute(character, key as AttributeKey) < (value || 0));
    if (failed) return { available: false, reason: `Недостаточно: ${failed[0]}` };
  }
  return { available: true };
}

export function resolveChoice(choice: StoryChoice, character: Character, context: ChoiceCheckContext = {}): ChoiceResolution {
  if (!choice.check) {
    return {
      choiceId: choice.id,
      success: true,
      summary: 'Выбор принят без проверки.',
      gainedItems: choice.consequences.grantItems || [],
      lostItems: choice.consequences.removeItems || [],
      hpChange: choice.consequences.hpChange || 0,
      goldChange: choice.consequences.successGold || 0,
    };
  }

  const preview = previewChoiceCheck(choice, character, context)!;
  const rollD20 = context.rollD20 || secureD20;
  const first = Math.max(1, Math.min(20, Math.floor(rollD20())));
  const second = preview.advantageReason ? Math.max(1, Math.min(20, Math.floor(rollD20()))) : undefined;
  const roll = second ? Math.max(first, second) : first;
  const total = roll + preview.modifier + preview.proficiency + preview.itemBonus;
  const success = roll === 20 || (roll !== 1 && total >= preview.difficulty);
  return {
    choiceId: choice.id,
    success,
    roll,
    total,
    difficulty: preview.difficulty,
    attribute: preview.attribute,
    attributeModifier: preview.modifier,
    skill: preview.skill,
    proficiencyBonus: preview.proficiency,
    itemBonus: preview.itemBonus,
    itemBonusLabel: preview.itemBonusLabel,
    rolls: second ? [first, second] : [first],
    advantageReason: preview.advantageReason,
    successChance: preview.successChance,
    summary: success ? 'Проверка пройдена.' : 'Проверка провалена.',
    gainedItems: success ? choice.consequences.grantItems || [] : [],
    lostItems: choice.consequences.removeItems || [],
    hpChange: choice.consequences.hpChange || 0,
    goldChange: success ? choice.consequences.successGold || 0 : choice.consequences.failureGold || 0,
  };
}
