-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Fix character_stats storage in game_sessions
-- Дата: 2026-03-15
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. RPC функция для атомарного обновления character_stats
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_character_stats_atomic(
  p_session_id TEXT,
  p_player_name TEXT,
  p_stats JSONB
)
RETURNS VOID AS $$
DECLARE
  v_current_stats JSONB;
  v_updated_stats JSONB;
BEGIN
  -- Получаем текущие character_stats
  SELECT character_stats
  INTO v_current_stats
  FROM game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  -- Если stats NULL, создаём пустой объект
  IF v_current_stats IS NULL THEN
    v_current_stats := '{}'::jsonb;
  END IF;

  -- Обновляем статы конкретного персонажа
  v_updated_stats := jsonb_set(
    v_current_stats,
    ARRAY[p_player_name],
    p_stats,
    true -- create_if_missing = true
  );

  -- Обновляем запись в game_sessions
  UPDATE game_sessions
  SET character_stats = v_updated_stats,
      updated_at = NOW()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- 2. Добавляем updated_at в game_sessions если нет
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Индекс для производительности
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_game_sessions_updated
ON game_sessions(updated_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 4. RLS политики для update_character_stats_atomic
-- ═══════════════════════════════════════════════════════════════

-- Разрешаем authenticated пользователям вызывать функцию
DROP POLICY IF EXISTS "Allow authenticated users to update character stats" ON game_sessions;
CREATE POLICY "Allow authenticated users to update character stats"
  ON game_sessions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 5. Триггер для автообновления updated_at
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_game_sessions_updated_at ON game_sessions;
CREATE TRIGGER update_game_sessions_updated_at
  BEFORE UPDATE ON game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- ПРИМЕЧАНИЕ:
-- character_stats теперь хранится ТОЛЬКО в game_sessions
-- Таблица characters используется только для хранения шаблонов персонажей
-- При загрузке сессии данные берутся из game_sessions.character_stats
-- ═══════════════════════════════════════════════════════════════
