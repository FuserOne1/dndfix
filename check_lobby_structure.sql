-- ═══════════════════════════════════════════════════════════════
-- ПРОВЕРКА: ЕСТЬ ЛИ ПОЛЕ code В lobbies
-- ═══════════════════════════════════════════════════════════════

-- Проверяем структуру таблицы lobbies
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'lobbies'
ORDER BY ordinal_position;

-- Проверяем есть ли данные в lobbies
SELECT COUNT(*) as total_lobbies FROM lobbies;

-- Если поле code есть - проверяем данные
-- (этот запрос упадёт если поля нет)
SELECT id, code, name, created_by, created_at 
FROM lobbies 
ORDER BY created_at DESC 
LIMIT 5;
