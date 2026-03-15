-- ═══════════════════════════════════════════════════════════════
-- FIX: Добавляем is_ai_generating в game_sessions
-- Дата: 2026-03-15
-- ═══════════════════════════════════════════════════════════════

-- Добавляем поле is_ai_generating если нет
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS is_ai_generating BOOLEAN DEFAULT false;

-- Индекс для производительности
CREATE INDEX IF NOT EXISTS idx_game_sessions_ai_generating
ON game_sessions(is_ai_generating);
