-- ═══════════════════════════════════════════════════════════════
-- ИСПРАВЛЕНИЕ RLS ПОЛИТИК ДЛЯ game_sessions
-- ═══════════════════════════════════════════════════════════════

-- Отключаем существующие политики
DROP POLICY IF EXISTS "Users can view game sessions they are part of" ON game_sessions;
DROP POLICY IF EXISTS "Users can create game sessions" ON game_sessions;

-- Включаем RLS
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Любой может читать сессии
CREATE POLICY "Allow read access to all sessions"
  ON game_sessions FOR SELECT
  USING (true);

-- Любой authenticated пользователь может создавать сессии
CREATE POLICY "Allow insert access"
  ON game_sessions FOR INSERT
  WITH CHECK (true);

-- Любой может удалять свои сессии
CREATE POLICY "Allow delete access"
  ON game_sessions FOR DELETE
  USING (created_by = current_setting('app.user_session_id', TRUE));

-- Проверяем что политики созданы
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('game_sessions', 'game_session_participants');
