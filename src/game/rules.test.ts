import { afterEach, describe, expect, it, vi } from 'vitest';
import { Character } from '../types';
import { BASE_SCORES, POINT_BUY_BUDGET, applyLineageBonuses, attributeModifier, buildCharacterDraft, calculateMaxHp, isChoiceAvailable, pointBuyCost, resolveChoice } from './rules';
import { BackstoryData, StoryChoice } from './types';

const story: BackstoryData = { homeland: 'Север', goal: 'Найти брата', loss: 'Дом', connection: 'Наставник', fear: 'Глубина', secret: 'Вина', values: ['Верность'], hooks: ['Пропавший брат'], prose: 'Достаточно длинная предыстория героя для проверки.' };

afterEach(() => vi.restoreAllMocks());

describe('Chronicles d20 character rules', () => {
  it('считает point-buy по нелинейной стоимости', () => {
    expect(pointBuyCost({ ...BASE_SCORES, strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 })).toBe(POINT_BUY_BUDGET);
  });

  it('применяет бонусы наследия', () => {
    expect(applyLineageBonuses(BASE_SCORES, 'aelir')).toMatchObject({ dexterity: 10, wisdom: 9, strength: 8 });
  });

  it('рассчитывает модификаторы и HP без значений ниже единицы', () => {
    expect(attributeModifier(8)).toBe(-1);
    expect(attributeModifier(15)).toBe(2);
    expect(calculateMaxHp('arcanist', 1)).toBe(1);
  });

  it('собирает структурированный снимок героя', () => {
    const draft = buildCharacterDraft({ name: 'Эйра', lineageId: 'aelir', classId: 'arcanist', originId: 'scholar', scores: { ...BASE_SCORES, intelligence: 15 }, skills: ['Природа', 'Медицина'], backstory: story, avatarIcon: 'arcanist' });
    expect(draft).toMatchObject({ name: 'Эйра', race: 'Эльф', class: 'Арканист', background: 'Исследователь' });
    expect(draft.rules_data?.selectedSkills).toEqual(expect.arrayContaining(['Знание', 'Расследование', 'Природа']));
    expect(draft.backstory_data?.hooks).toEqual(['Пропавший брат']);
  });
});

const character = {
  id: '1', name: 'Эйра', race: 'Аэлир', class: 'Арканист', level: 1, hp_current: 6, hp_max: 6, xp: 0,
  strength: 8, dexterity: 14, constitution: 10, intelligence: 16, wisdom: 12, charisma: 10, background: 'Исследователь', equipment: ['Ключ'], created_at: '', updated_at: '',
  rules_data: { rulesVersion: 1 as const, lineageId: 'aelir', classId: 'arcanist', originId: 'scholar', selectedSkills: ['Расследование'], traits: [], storyTags: [] },
} satisfies Character;

describe('story choices', () => {
  it('объясняет недоступность условного варианта', () => {
    const choice: StoryChoice = { id: 'x', label: 'Взломать', intent: 'взлом', requirements: { items: ['Отмычки'] }, consequences: {} };
    expect(isChoiceAvailable(choice, character, [], character.equipment)).toEqual({ available: false, reason: 'Требуется: Отмычки' });
  });

  it('добавляет мастерство только к указанному изученному навыку', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.45); // d20 = 10
    const trained: StoryChoice = { id: 'trained', label: 'Искать', intent: 'искать', check: { attribute: 'intelligence', difficulty: 17, skill: 'Расследование' }, consequences: {} };
    const untrained: StoryChoice = { ...trained, id: 'untrained', check: { ...trained.check!, skill: 'Природа' } };
    expect(resolveChoice(trained, character)).toMatchObject({ total: 15, success: false });
    expect(resolveChoice(untrained, character)).toMatchObject({ total: 13, success: false });
  });

  it('натуральная двадцатка и единица имеют приоритет', () => {
    const choice: StoryChoice = { id: 'check', label: 'Проверка', intent: 'проверить', check: { attribute: 'strength', difficulty: 50 }, consequences: {} };
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValueOnce(0);
    expect(resolveChoice(choice, character).success).toBe(true);
    expect(resolveChoice({ ...choice, check: { attribute: 'intelligence', difficulty: 1 } }, character).success).toBe(false);
  });
});
