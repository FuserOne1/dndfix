-- ═══════════════════════════════════════════════════════════════
-- FIX: RLS политики для анонимных пользователей
-- Дата: 2026-03-15
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. Создаём политики для anon роли (без аутентификации)
-- ═══════════════════════════════════════════════════════════════

-- SELECT: разрешаем читать всем (включая anon)
DROP POLICY IF EXISTS "select_all" ON game_session_participants;
CREATE POLICY "select_all"
  ON game_session_participants
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: разрешаем добавлять всем (включая anon)
DROP POLICY IF EXISTS "insert_all" ON game_session_participants;
CREATE POLICY "insert_all"
  ON game_session_participants
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- UPDATE: разрешаем обновлять всем (включая anon)
DROP POLICY IF EXISTS "update_all" ON game_session_participants;
CREATE POLICY "update_all"
  ON game_session_participants
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: разрешаем удалять всем (включая anon)
DROP POLICY IF EXISTS "delete_all" ON game_session_participants;
CREATE POLICY "delete_all"
  ON game_session_participants
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 2. Проверяем, что политики созданы
-- ═══════════════════════════════════════════════════════════════

SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'game_session_participants';
