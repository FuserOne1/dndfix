import { describe, expect, it } from 'vitest';
import type { CampaignPreferences, StoryScene } from './types';
import { sceneImageLayout, shouldAutoIllustrate } from './scene-images';

const preferences = { illustrationMode: 'important', artStyle: 'dark-comic' } as CampaignPreferences;
const scene = (type: StoryScene['type'], tension: StoryScene['tension'] = 3) => ({ id: 's', actId: 'a', title: 'Scene', location: 'Place', body: ['Text'], choices: [], type, tension } as StoryScene);

describe('scene illustrations', () => {
  it('always illustrates the opening in important mode', () => expect(shouldAutoIllustrate(scene('social'), 1, preferences)).toBe(true));
  it('uses cooldown for discoveries', () => expect(shouldAutoIllustrate(scene('discovery'), 4, preferences, 2)).toBe(false));
  it('does not suppress a climax with cooldown', () => expect(shouldAutoIllustrate(scene('climax'), 4, preferences, 3)).toBe(true));
  it('respects off and all modes', () => {
    expect(shouldAutoIllustrate(scene('rest'), 3, { ...preferences, illustrationMode: 'off' })).toBe(false);
    expect(shouldAutoIllustrate(scene('rest'), 3, { ...preferences, illustrationMode: 'all' })).toBe(true);
  });
  it('uses three panels only for major beats', () => {
    expect(sceneImageLayout(scene('climax'))).toBe('comic-3');
    expect(sceneImageLayout(scene('discovery', 5))).toBe('comic-3');
    expect(sceneImageLayout(scene('combat', 5))).toBe('wide');
  });
});
