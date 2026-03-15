-- ═══════════════════════════════════════════════════════════════
-- FIX: УПРОЩЁННАЯ АРХИТЕКТУРА - БЕЗ game_session_participants
-- Дата: 2026-03-15
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. Добавляем players в game_sessions (JSON массив)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS players JSONB DEFAULT '[]'::jsonb;

-- ═══════════════════════════════════════════════════════════════
-- 2. Проверяем структуру game_sessions
-- ═══════════════════════════════════════════════════════════════

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'game_sessions'
ORDER BY ordinal_position;
