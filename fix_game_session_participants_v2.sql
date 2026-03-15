-- ═══════════════════════════════════════════════════════════════
-- FIX: game_session_participants - ПОЛНАЯ МИГРАЦИЯ
-- Дата: 2026-03-15
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 0. Удаляем старую таблицу если есть (для чистоты)
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS game_session_participants CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 1. Создаём таблицу
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE game_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  character_id UUID NOT NULL,
  user_session_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. Добавляем FOREIGN KEY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE game_session_participants
  ADD CONSTRAINT fk_session
  FOREIGN KEY (session_id)
  REFERENCES game_sessions(id)
  ON DELETE CASCADE;

ALTER TABLE game_session_participants
  ADD CONSTRAINT fk_character
  FOREIGN KEY (character_id)
  REFERENCES characters(id)
  ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 3. Создаём UNIQUE индекс (вместо CONSTRAINT)
-- ═══════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX idx_session_user_unique
ON game_session_participants(session_id, user_session_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. Индексы для производительности
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX idx_session ON game_session_participants(session_id);
CREATE INDEX idx_user ON game_session_participants(user_session_id);
CREATE INDEX idx_character ON game_session_participants(character_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. Включаем RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE game_session_participants ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 6. Создаём RLS политики
-- ═══════════════════════════════════════════════════════════════

-- SELECT: разрешаем читать всем authenticated
CREATE POLICY "select_all_authenticated"
  ON game_session_participants
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: разрешаем добавлять всем authenticated
CREATE POLICY "insert_all_authenticated"
  ON game_session_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: разрешаем обновлять всем authenticated
CREATE POLICY "update_all_authenticated"
  ON game_session_participants
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: разрешаем удалять всем authenticated
CREATE POLICY "delete_all_authenticated"
  ON game_session_participants
  FOR DELETE
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 7. Миграция данных из lobby_participants
-- ═══════════════════════════════════════════════════════════════

INSERT INTO game_session_participants (session_id, character_id, user_session_id, joined_at)
SELECT 
  lp.lobby_id::TEXT,
  lp.character_id,
  lp.user_session_id,
  lp.joined_at
FROM lobby_participants lp
WHERE NOT EXISTS (
  SELECT 1 FROM game_session_participants gsp
  WHERE gsp.session_id = lp.lobby_id::TEXT
  AND gsp.user_session_id = lp.user_session_id
);
