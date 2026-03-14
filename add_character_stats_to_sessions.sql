-- ═══════════════════════════════════════════════════════════════
-- ДОБАВЛЕНИЕ character_stats В game_sessions
-- ═══════════════════════════════════════════════════════════════

-- Добавляем колонку character_stats
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS character_stats JSONB DEFAULT '{}'::jsonb;

-- Индекс для производительности
CREATE INDEX IF NOT EXISTS idx_game_sessions_character_stats 
  ON game_sessions USING gin (character_stats);

-- Проверяем
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'game_sessions' AND column_name = 'character_stats';
