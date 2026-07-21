import { describe, expect, it } from 'vitest';
import { choiceGlyph, getScenePresentation } from './scene-presentation';
import type { StoryScene } from './types';

function scene(type: StoryScene['type'], text: string, tension: StoryScene['tension'] = 2): StoryScene {
  return { id: 'scene', actId: 'act', title: text, location: text, body: [text], type, tension, choices: [] };
}

describe('local scene presentation', () => {
  it('maps scene types to stable visual identities without AI', () => {
    expect(getScenePresentation(scene('combat', 'Крепостной двор', 4))).toMatchObject({ palette: 'ember', weather: 'embers', tension: 4, glyph: '⚔' });
    expect(getScenePresentation(scene('rest', 'Тихий привал'))).toMatchObject({ palette: 'rest', label: 'Отдых' });
  });

  it('detects atmospheric weather from scene text', () => {
    expect(getScenePresentation(scene('travel', 'Снежный перевал')).weather).toBe('snow');
    expect(getScenePresentation(scene('investigation', 'Дождь над старым портом')).weather).toBe('rain');
  });

  it('marks item and combat choices with distinct glyphs', () => {
    expect(choiceGlyph({ requirements: { items: ['Верёвка'] }, consequences: {} })).toBe('◆');
    expect(choiceGlyph({ consequences: { startsBattle: true } })).toBe('⚔');
  });
});
