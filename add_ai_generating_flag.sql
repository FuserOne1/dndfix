-- Добавляем флаг генерации AI для синхронизации между игроками
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS is_ai_generating BOOLEAN DEFAULT false;

-- Индекс для быстрого обновления
CREATE INDEX IF NOT EXISTS idx_rooms_ai_generating ON rooms(is_ai_generating);

-- Комментарий
COMMENT ON COLUMN rooms.is_ai_generating IS 'Флаг для синхронизации индикатора генерации AI между всеми игроками';
