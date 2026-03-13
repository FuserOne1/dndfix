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

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  is_ai: boolean;
}

export interface Room {
  id: string;
  created_at: string;
  created_by: string;
  lobby_id?: string;
  // Храним характеристики для каждого игрока по имени
  character_stats?: Record<string, CharacterStats>;
}

// Новые типы для системы лобби
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
  equipment: string[];
  story_summary?: string;
  avatar_url?: string;
  avatar_icon?: string; // Новое поле для иконки аватара
  created_at: string;
  updated_at: string;
}

export interface Lobby {
  id: string;
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
  character?: Character; // Populated via join
}
