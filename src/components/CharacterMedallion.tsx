import { memo } from 'react';
import type { Character } from '../types';
import { getClassDefinition, getLineage } from '../game/catalog';

function CharacterMedallion({ character, compact = false }: { character: Character; compact?: boolean }) {
  const lineage = character.rules_data ? getLineage(character.rules_data.lineageId) : undefined;
  const heroClass = character.rules_data ? getClassDefinition(character.rules_data.classId) : undefined;
  const health = Math.max(0, Math.min(100, character.hp_max ? character.hp_current / character.hp_max * 100 : 0));
  return <div className={`character-medallion ${compact ? 'character-medallion-compact' : ''}`} title={`${character.name} · ${character.hp_current}/${character.hp_max} HP`}>
    <div className="character-medallion-ring" style={{ background: `conic-gradient(var(--scene-accent) ${health}%, rgba(63,63,70,.7) ${health}% 100%)` }}>
      <div className="character-medallion-face"><span>{lineage?.icon || character.name.slice(0, 1).toUpperCase()}</span><small>{heroClass?.icon || '◆'}</small></div>
    </div>
    {!compact && <div className="min-w-0"><strong>{character.name}</strong><span>{character.race} · {character.class}</span></div>}
  </div>;
}

export default memo(CharacterMedallion);
