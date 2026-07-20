import { describe, expect, it } from 'vitest';
import { createCampaignVariation } from './campaign-generator';

describe('campaign generation variation', () => {
  it('gives every campaign request a unique creative key', () => {
    const variants = Array.from({ length: 20 }, () => createCampaignVariation());
    expect(new Set(variants.map(variant => variant.id)).size).toBe(20);
    expect(variants.every(variant => variant.openingShape && variant.conflictEngine && variant.sensoryMotif)).toBe(true);
  });
});
