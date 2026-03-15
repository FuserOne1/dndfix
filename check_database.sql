-- ═══════════════════════════════════════════════════════════════
-- ПРОВЕРКА: Структура БД
-- ═══════════════════════════════════════════════════════════════

-- 1. Проверяем, существует ли таблица
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('game_sessions', 'game_session_participants', 'characters', 'messages');

-- 2. Проверяем колонки game_session_participants
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'game_session_participants'
ORDER BY ordinal_position;

-- 3. Проверяем RLS политики
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'game_session_participants';

-- 4. Проверяем, включен ли RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'game_session_participants';

-- 5. Проверяем данные в game_sessions
SELECT id, created_at, character_stats IS NOT NULL as has_stats
FROM game_sessions
ORDER BY created_at DESC
LIMIT 10;

-- 6. Проверяем данные в game_session_participants (если есть)
SELECT session_id, character_id, user_session_id, joined_at
FROM game_session_participants
ORDER BY joined_at DESC
LIMIT 10;
