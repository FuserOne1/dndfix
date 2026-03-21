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
  gold?: number;
  equipment: string[];
  story_summary?: string;
  avatar_icon?: string;
  created_at: string;
  updated_at: string;
}

// Устаревший тип (для обратной совместимости, не использовать)
/** @deprecated Use Character directly */
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
  story_summary?: string;
}

// ═══════════════════════════════════════════════════════════════
// СООБЩЕНИЯ
// ═══════════════════════════════════════════════════════════════

export interface Message {
  id: string;
  session_id: string; // Было: room_id
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  is_ai: boolean;
}

// ═══════════════════════════════════════════════════════════════
// ЛОББИ
// ═══════════════════════════════════════════════════════════════

export interface Lobby {
  id: string; // UUID
  code: string; // Короткий код для ввода (например "A1B2C3")
  name: string;
  max_players: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  started_at?: string;
  settings?: Record<string, any>;
}

export interface LobbyParticipant {
  id: string;
  lobby_id: string;
  character_id: string;
  user_session_id: string;
  joined_at: string;
  is_ready: boolean;
  character?: Character;
}

// ═══════════════════════════════════════════════════════════════
// ИГРОВЫЕ СЕССИИ (вместо Room)
// ═══════════════════════════════════════════════════════════════

export interface GameSession {
  id: string; // Короткий код (например "A1B2C3")
  lobby_id?: string;
  created_by: string;
  created_at: string;
}

export interface GameSessionParticipant {
  id: string;
  session_id: string;
  character_id: string;
  user_session_id: string;
  joined_at: string;
  character?: Character;
}

// ═══════════════════════════════════════════════════════════════
// УСТАРЕВШИЕ ТИПЫ (для обратной совместимости)
// ═══════════════════════════════════════════════════════════════

/** @deprecated Use GameSession instead */
export interface Room {
  id: string;
  created_at: string;
  created_by: string;
  lobby_id?: string;
}
