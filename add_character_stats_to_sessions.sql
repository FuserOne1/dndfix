-- ═══════════════════════════════════════════════════════════════
-- ДОБАВЛЕНИЕ character_stats и is_ai_generating В game_sessions
-- ═══════════════════════════════════════════════════════════════

-- Добавляем колонку character_stats
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS character_stats JSONB DEFAULT '{}'::jsonb;

-- Добавляем колонку is_ai_generating
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS is_ai_generating BOOLEAN DEFAULT false;

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_game_sessions_character_stats 
  ON game_sessions USING gin (character_stats);

CREATE INDEX IF NOT EXISTS idx_game_sessions_ai_generating 
  ON game_sessions(is_ai_generating);

-- Проверяем
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'game_sessions' 
  AND column_name IN ('character_stats', 'is_ai_generating');
