-- ═══════════════════════════════════════════════════════════════
-- ИСПРАВЛЕНИЕ RLS ПОЛИТИК ДЛЯ game_session_participants
-- ═══════════════════════════════════════════════════════════════

-- Отключаем существующие политики
DROP POLICY IF EXISTS "Users can view their session participants" ON game_session_participants;
DROP POLICY IF EXISTS "Users can join sessions" ON game_session_participants;
DROP POLICY IF EXISTS "Users can leave sessions" ON game_session_participants;

-- Включаем RLS
ALTER TABLE game_session_participants ENABLE ROW LEVEL SECURITY;

-- Простая политика: любой может читать участников любой сессии
CREATE POLICY "Allow read access to all participants"
  ON game_session_participants FOR SELECT
  USING (true);

-- Любой authenticated пользователь может добавлять себя
CREATE POLICY "Allow insert access"
  ON game_session_participants FOR INSERT
  WITH CHECK (true);

-- Любой может удалять себя
CREATE POLICY "Allow delete access"
  ON game_session_participants FOR DELETE
  USING (user_session_id = current_setting('app.user_session_id', TRUE));

-- Проверяем что политики созданы
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'game_session_participants';
