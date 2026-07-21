// ═══════════════════════════════════════════════════════════════
// ТИПЫ ДЛЯ D&D DARK FANTASY RPG
// Миграция 2026-03-14: Новая архитектура сессий
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ПЕРСОНАЖИ
// ═══════════════════════════════════════════════════════════════

export interface Character {
  id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  hp_current: number;
  hp_max: number;
  xp: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  background: string;
  feat?: string;
  special_item?: string;
  special_item_description?: string;
  abilities?: string;
  gold?: number;
  equipment: string[];
  inventory_data?: import('./game/types').InventoryData;
  story_summary?: string;
  rules_data?: import('./game/types').CharacterRulesData;
  backstory_data?: import('./game/types').BackstoryData;
  avatar_icon?: string;
  created_at: string;
  updated_at: string;
}

// Устаревший тип (для обратной совместимости, не использовать)
/** @deprecated Use Character directly */
export interface ItemEffect {
  heal?: number;
  tempHp?: number;
  damage?: number;
  damageDice?: string;
  buffAc?: number;
  buffAtk?: number;
  buffDmg?: number;
  condition?: string;
  description?: string;
}

export interface CharacterStats {
  name: string;
  race: string;
  class: string;
  level: number;
  hp: {
    current: number;
    max: number;
  };
  xp: number;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  background: string;
  equipment: string[];
  combat_items?: string[];
  passive_bonuses?: { ac: number; attack: number; damage: number };
  story_summary?: string;
  item_effects?: Record<string, ItemEffect>;
}

// ═══════════════════════════════════════════════════════════════
// СООБЩЕНИЯ
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ЛОББИ
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ИГРОВЫЕ СЕССИИ (вместо Room)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// УСТАРЕВШИЕ ТИПЫ (для обратной совместимости)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// БОЕВАЯ СИСТЕМА (старая — удаляется)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// БОЕВАЯ СИСТЕМА (новая — мини-игра)
// ═══════════════════════════════════════════════════════════════

export interface EnemyAttack {
  name: string;
  toHit: number;
  dice: string;
  bonus: number;
}

export interface BattleEnemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  ac: number;
  initiative: number;
  attacks: EnemyAttack[];
  statusEffects: string[];
  xpReward: number;
}

export interface BattleRewards {
  xp: number;
  items: string[];
}

export interface BattleStartData {
  enemies: BattleEnemy[];
  rewards: BattleRewards;
  description: string;
}

export interface BattleResult {
  victory: boolean;
  xpGained: number;
  itemsGained: string[];
  itemsConsumed: string[];
  finalHp: number;
  damageTaken: number;
  enemiesDefeated: string[];
  log: string[];
}
