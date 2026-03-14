-- ═══════════════════════════════════════════════════════════════
-- ДОБАВЛЕНИЕ ПОЛЯ code ДЛЯ LOBBIES
-- DATE: 2026-03-14
-- ═══════════════════════════════════════════════════════════════

-- Добавляем поле code (если ещё не добавлено)
ALTER TABLE lobbies 
ADD COLUMN IF NOT EXISTS code TEXT;

-- Создаём индекс для поиска по коду
CREATE INDEX IF NOT EXISTS idx_lobbies_code ON lobbies(code);

-- Делаем поле UNIQUE и NOT NULL (после того как все записи получат code)
-- Сначала генерируем code для существующих лобби
UPDATE lobbies 
SET code = UPPER(substring(md5(id::text) from 1 for 6))
WHERE code IS NULL;

-- Теперь делаем поле NOT NULL и UNIQUE
ALTER TABLE lobbies 
ALTER COLUMN code SET NOT NULL;

ALTER TABLE lobbies 
ADD CONSTRAINT lobbies_code_unique UNIQUE (code);

-- Проверяем результат
SELECT id, code, name, created_at 
FROM lobbies 
ORDER BY created_at DESC;
