import { afterEach, describe, expect, it, vi } from 'vitest';
import { CharacterStats } from '../types';
import {
  createInitiativeOrder,
  getPlayerAC,
  getPlayerAtkBonus,
  parseBattleStartData,
  processItemEffect,
  resolveAttack,
  rollDice,
} from './battle-engine';

const stats: CharacterStats = {
  name: 'Тестовый герой',
  race: 'Человек',
  class: 'Воин',
  level: 1,
  hp: { current: 8, max: 12 },
  xp: 0,
  stats: {
    strength: 8,
    dexterity: 16,
    constitution: 12,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
  background: '',
  equipment: ['Кожаная броня', 'Щит', 'Кинжал'],
  item_effects: {
    'Зелье лечения': { heal: 5, tempHp: 3 },
    'Огненная бомба': { damageDice: '1d6', buffAtk: 1 },
  },
};

afterEach(() => vi.restoreAllMocks());

describe('rollDice', () => {
  it('поддерживает отрицательный модификатор', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(rollDice('2d6 - 1')).toBe(1);
  });

  it('отбрасывает опасные и некорректные выражения', () => {
    expect(rollDice('0d6')).toBe(0);
    expect(rollDice('1000d1000')).toBe(0);
    expect(rollDice('alert(1)')).toBe(0);
  });
});

describe('resolveAttack', () => {
  it('натуральная единица всегда промахивается', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = resolveAttack(100, '1d8', 100, 1);
    expect(result).toMatchObject({ fumble: true, hit: false, damage: 0 });
  });

  it('урон не становится отрицательным', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(resolveAttack(100, '1d4', -100, 1).damage).toBe(0);
  });
});

describe('character combat values', () => {
  it('учитывает броню, щит и finesse-оружие', () => {
    expect(getPlayerAC(stats)).toBe(16);
    expect(getPlayerAtkBonus(stats)).toBe(5);
  });
});

describe('items', () => {
  it('ищет эффект без учёта регистра и не смешивает временные HP с лечением', () => {
    const result = processItemEffect('ЗЕЛЬЕ ЛЕЧЕНИЯ (малое)', stats);
    expect(result.found).toBe(true);
    expect(result.healAmount).toBe(5);
    expect(result.tempHpAmount).toBe(3);
  });

  it('не разрешает неизвестному предмету создавать эффект', () => {
    expect(processItemEffect('Обычный камень', stats).found).toBe(false);
  });

  it('поддерживает стандартные зелья у старых персонажей без item_effects', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = processItemEffect('Зелье лечения', { ...stats, item_effects: undefined });
    expect(result).toMatchObject({ found: true, healAmount: 4, tempHpAmount: 0 });
  });
});

describe('battle input validation', () => {
  it('нормализует границы, атаки и повторяющиеся id', () => {
    const result = parseBattleStartData({
      enemies: [
        { id: 'goblin', name: 'Гоблин', hp: -50, ac: 999, attacks: [{ dice: 'hack' }] },
        { id: 'goblin', name: 'Гоблин 2', hp: 5, attacks: [] },
      ],
      rewards: { xp: -100, items: ['Ключ', 'Ключ', 42] },
    });
    expect(result).not.toBeNull();
    expect(result!.enemies[0]).toMatchObject({ id: 'goblin', hp: 1, ac: 50 });
    expect(result!.enemies[0].attacks[0].dice).toBe('1d4');
    expect(result!.enemies[1].id).toBe('goblin-2');
    expect(result!.rewards).toEqual({ xp: 0, items: ['Ключ'] });
  });

  it('отклоняет пустую и слишком большую группу врагов', () => {
    expect(parseBattleStartData({ enemies: [] })).toBeNull();
    expect(parseBattleStartData({ enemies: Array.from({ length: 21 }, () => ({})) })).toBeNull();
  });
});

describe('initiative', () => {
  it('сортирует игрока и врагов по инициативе', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemies = parseBattleStartData({ enemies: [{ id: 'fast', initiative: 20 }, { id: 'slow', initiative: 0 }] })!.enemies;
    expect(createInitiativeOrder(stats, enemies).map(entry => entry.id)).toEqual(['fast', 'player', 'slow']);
  });
});
