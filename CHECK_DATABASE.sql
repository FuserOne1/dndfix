-- =====================================================
-- ПРОВЕРКА БАЗЫ ДАННЫХ
-- =====================================================

-- 1. Проверяем, что таблица rooms существует
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'rooms';

-- 2. Проверяем колонки в rooms
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'rooms'
ORDER BY ordinal_position;

-- 3. Проверяем, что есть колонка character_stats
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'rooms'
  AND column_name = 'character_stats';

-- 4. Проверяем, что есть колонка is_ai_generating
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'rooms'
  AND column_name = 'is_ai_generating';

-- 5. Проверяем таблицу messages
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages'
ORDER BY ordinal_position;

-- 6. Проверяем таблицу lobby_participants
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'lobby_participants'
ORDER BY ordinal_position;

-- =====================================================
-- ЕСЛИ НЕТ is_ai_generating - ДОБАВИТЬ
-- =====================================================

-- Добавить колонку для синхронизации индикатора AI
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS is_ai_generating BOOLEAN DEFAULT false;

-- Индекс для быстрого обновления
CREATE INDEX IF NOT EXISTS idx_rooms_ai_generating ON rooms(is_ai_generating);

-- Комментарий
COMMENT ON COLUMN rooms.is_ai_generating IS 'Флаг для синхронизации индикатора генерации AI между всеми игроками';

-- =====================================================
-- ТЕСТОВЫЕ ДАННЫЕ
-- =====================================================

-- Посмотреть последнюю комнату
SELECT id, created_by, character_stats, is_ai_generating, created_at
FROM rooms
ORDER BY created_at DESC
LIMIT 1;

-- Посмотреть последние сообщения
SELECT id, room_id, sender_name, content, is_ai, created_at
FROM messages
ORDER BY created_at DESC
LIMIT 5;
