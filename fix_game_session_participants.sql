-- ═══════════════════════════════════════════════════════════════
-- FIX: game_session_participants таблица и RLS политики
-- Дата: 2026-03-15
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. Создаём таблицу game_session_participants если нет
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS game_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_session_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_session_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 2. Индексы для производительности
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_game_session_participants_session
ON game_session_participants(session_id);

CREATE INDEX IF NOT EXISTS idx_game_session_participants_user
ON game_session_participants(user_session_id);

CREATE INDEX IF NOT EXISTS idx_game_session_participants_character
ON game_session_participants(character_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. RLS политики
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE game_session_participants ENABLE ROW LEVEL SECURITY;

-- Разрешаем authenticated пользователям читать свои записи
DROP POLICY IF EXISTS "Users can view own session participants" ON game_session_participants;
CREATE POLICY "Users can view own session participants"
  ON game_session_participants
  FOR SELECT
  TO authenticated
  USING (true);

-- Разрешаем добавлять участников
DROP POLICY IF EXISTS "Users can insert session participants" ON game_session_participants;
CREATE POLICY "Users can insert session participants"
  ON game_session_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Разрешаем обновлять свои записи
DROP POLICY IF EXISTS "Users can update own session participants" ON game_session_participants;
CREATE POLICY "Users can update own session participants"
  ON game_session_participants
  FOR UPDATE
  TO authenticated
  USING (true);

-- Разрешаем удалять свои записи
DROP POLICY IF EXISTS "Users can delete own session participants" ON game_session_participants;
CREATE POLICY "Users can delete own session participants"
  ON game_session_participants
  FOR DELETE
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 4. Миграция данных из lobby_participants если есть
-- ═══════════════════════════════════════════════════════════════

-- Копируем данные из lobby_participants если таблица существует
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lobby_participants') THEN
    INSERT INTO game_session_participants (session_id, character_id, user_session_id, joined_at)
    SELECT lobby_id, character_id, user_session_id, joined_at
    FROM lobby_participants
    WHERE NOT EXISTS (
      SELECT 1 FROM game_session_participants gsp
      WHERE gsp.session_id = lobby_participants.lobby_id
      AND gsp.user_session_id = lobby_participants.user_session_id
    );
  END IF;
END $$;
