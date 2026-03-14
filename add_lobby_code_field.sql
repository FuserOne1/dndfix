-- ═══════════════════════════════════════════════════════════════
-- ДОБАВЛЕНИЕ ПОЛЯ code ДЛЯ LOBBIES
-- DATE: 2026-03-14
-- Исправленная версия
-- ═══════════════════════════════════════════════════════════════

-- 1. Добавляем поле code (может быть NULL сначала)
ALTER TABLE lobbies 
ADD COLUMN IF NOT EXISTS code TEXT;

-- 2. Создаём индекс
CREATE INDEX IF NOT EXISTS idx_lobbies_code ON lobbies(code);

-- 3. Заполняем code для существующих записей
UPDATE lobbies 
SET code = UPPER(substring(md5(id::text) from 1 for 6))
WHERE code IS NULL;

-- 4. Проверяем что все записи получили code
SELECT COUNT(*) as total, COUNT(code) as with_code 
FROM lobbies;

-- 5. Делаем поле NOT NULL
ALTER TABLE lobbies 
ALTER COLUMN code SET NOT NULL;

-- 6. Добавляем UNIQUE constraint (если ещё нет)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'lobbies_code_unique'
    ) THEN
        ALTER TABLE lobbies 
        ADD CONSTRAINT lobbies_code_unique UNIQUE (code);
    END IF;
END
$$;

-- 7. Проверяем результат
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'lobbies' AND column_name = 'code';

SELECT id, code, name, created_at 
FROM lobbies 
ORDER BY created_at DESC 
LIMIT 5;
