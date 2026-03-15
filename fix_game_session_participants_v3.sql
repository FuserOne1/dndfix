-- ═══════════════════════════════════════════════════════════════
-- FIX: game_session_participants - БЕЗ FOREIGN KEY
-- Дата: 2026-03-15
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. Удаляем старую таблицу
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS game_session_participants CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 2. Создаём таблицу БЕЗ FOREIGN KEY
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE game_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  character_id UUID NOT NULL,
  user_session_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 3. Индексы
-- ═══════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX idx_session_user_unique
ON game_session_participants(session_id, user_session_id);

CREATE INDEX idx_session ON game_session_participants(session_id);
CREATE INDEX idx_user ON game_session_participants(user_session_id);
CREATE INDEX idx_character ON game_session_participants(character_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE game_session_participants ENABLE ROW LEVEL SECURITY;

-- Политики для ВСЕХ (включая anon)
DROP POLICY IF EXISTS "select_all" ON game_session_participants;
CREATE POLICY "select_all"
  ON game_session_participants
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_all" ON game_session_participants;
CREATE POLICY "insert_all"
  ON game_session_participants
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_all" ON game_session_participants;
CREATE POLICY "update_all"
  ON game_session_participants
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "delete_all" ON game_session_participants;
CREATE POLICY "delete_all"
  ON game_session_participants
  FOR DELETE
  TO anon, authenticated
  USING (true);
