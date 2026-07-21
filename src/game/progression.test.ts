import { describe, expect, it } from 'vitest';
import type { Character } from '../types';
import { applyExperience, experienceForScene, levelForXp, xpForLevel } from './progression';
import type { ChoiceResolution, StoryScene } from './types';

const character: Character = {
  id: 'hero', name: 'Герой', race: 'Человек', class: 'Воин', level: 1,
  hp_current: 8, hp_max: 10, xp: 90, strength: 14, dexterity: 12,
  constitution: 12, intelligence: 10, wisdom: 10, charisma: 10,
  background: 'Странник', equipment: [], created_at: '', updated_at: '',
};

const resolution: ChoiceResolution = {
  choiceId: 'choice', success: true, roll: 14, summary: 'Успех', gainedItems: [],
  lostItems: [], hpChange: 0, goldChange: 0,
};

function scene(type: StoryScene['type'], tension: StoryScene['tension'] = 1): StoryScene {
  return { id: 'scene', actId: 'act', title: 'Сцена', location: 'Путь', body: [], type, tension, choices: [] };
}

describe('character progression', () => {
  it('awards deterministic experience for non-combat scenes', () => {
    expect(experienceForScene(scene('investigation', 3), resolution)).toBe(28);
    expect(experienceForScene(scene('combat', 5), resolution)).toBe(0);
  });

  it('uses campaign-sized level thresholds', () => {
    expect(xpForLevel(2)).toBe(100);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
  });

  it('levels up and preserves missing health while increasing maximum hp', () => {
    const result = applyExperience(character, 20);
    expect(result).toMatchObject({ xpGained: 20, levelBefore: 1, levelAfter: 2 });
    expect(result.character.xp).toBe(110);
    expect(result.character.hp_max).toBeGreaterThan(character.hp_max);
    expect(result.character.hp_max - result.character.hp_current).toBe(2);
  });
});
