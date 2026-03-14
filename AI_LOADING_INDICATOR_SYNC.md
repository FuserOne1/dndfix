# Синхронизация индикатора генерации AI

## Проблема
Индикатор "Мастер плетет историю..." отображался только у того игрока, который отправил сообщение. Другие игроки не видели, что AI генерирует ответ.

## Причина
`isLoading` — локальное состояние (`useState`), которое устанавливается только у отправителя сообщения.

## Решение

### 1. Глобальное состояние
Добавлено состояние `isAIGenerating`, которое синхронизируется между всеми игроками через базу данных.

```typescript
const [isAIGenerating, setIsAIGenerating] = useState(false);
```

### 2. Подписка на изменения
Добавлена подписка на изменения в таблице `rooms`:

```typescript
.on(
  'postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'rooms',
    filter: `id=eq.${roomId}`,
  },
  (payload) => {
    const newIsGenerating = payload.new.is_ai_generating;
    const oldIsGenerating = payload.old.is_ai_generating;
    if (newIsGenerating !== oldIsGenerating) {
      setIsAIGenerating(!!newIsGenerating);
    }
  }
)
```

### 3. Установка флага при начале генерации
```typescript
isGeneratingAI.current = true;

// Устанавливаем флаг генерации AI в БД — все игроки увидят индикатор
setIsAIGenerating(true);
await supabase
  .from('rooms')
  .update({ is_ai_generating: true })
  .eq('id', roomId);
```

### 4. Сброс флага после ответа AI
```typescript
isGeneratingAI.current = false;

// Сбрасываем флаг генерации AI в БД
supabase
  .from('rooms')
  .update({ is_ai_generating: false })
  .eq('id', roomId);
```

### 5. Обновление отображения
Заменено условие с `isLoading` на `isAIGenerating`:

```typescript
{isAIGenerating && (
  <div className="p-12 flex flex-col items-center justify-center gap-4 text-primary/50 animate-pulse">
    <Loader2 className="w-8 h-8 animate-spin" />
    <span className="text-xs font-mono uppercase tracking-[0.3em]">Мастер плетет историю...</span>
  </div>
)}
```

### 6. SQL миграция
Добавлена колонка `is_ai_generating` в таблицу `rooms`:

```sql
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS is_ai_generating BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_rooms_ai_generating ON rooms(is_ai_generating);
```

## Архитектура

```
Игрок 1 отправляет сообщение
         ↓
Установка isAIGenerating = true (локально)
         ↓
Обновление rooms.is_ai_generating = true (БД)
         ↓
postgres_changes уведомление
         ↓
Все игроки получают обновление
         ↓
У всех игроков: setIsAIGenerating(true)
         ↓
У всех отображается "Мастер плетет историю..."
         ↓
AI отвечает
         ↓
Вставка сообщения в БД
         ↓
postgres_changes уведомление
         ↓
Все игроки сбрасывают флаг
```

## Тестирование

### Сценарий 1: Один игрок
1. ✅ Игрок отправляет сообщение
2. ✅ Отображается "Мастер плетет историю..."
3. ✅ AI отвечает
4. ✅ Индикатор исчезает

### Сценарий 2: Несколько игроков
1. ✅ Игрок 1 отправляет сообщение
2. ✅ **Все игроки** видят "Мастер плетет историю..."
3. ✅ AI отвечает
4. ✅ **У всех игроков** индикатор исчезает

### Сценарий 3: Одновременные запросы
1. ✅ Игрок 1 отправляет сообщение
2. ✅ Игрок 2 отправляет сообщение (пока AI генерирует)
3. ✅ Индикатор продолжает отображаться
4. ✅ AI отвечает на оба сообщения по очереди

## Примечания

### Локальное vs Глобальное состояние

**`isLoading` (локальное):**
- Используется для отправки сообщений игроком
- Показывает, что сообщение отправляется
- Только у отправителя

**`isAIGenerating` (глобальное):**
- Используется для генерации ответа AI
- Показывает, что AI "думает"
- У всех игроков в комнате

### Производительность

- Подписка на `postgres_changes` эффективна
- Обновление флага происходит 2 раза за запрос (вкл/выкл)
- Индекс на `is_ai_generating` ускоряет обновление

### Безопасность

- Флаг обновляется только для текущей комнаты (`room_id`)
- Любой игрок может установить/сбросить флаг (это ожидаемое поведение)

## Файлы изменены

- `src/components/Chat.tsx` — добавлена синхронизация
- `add_ai_generating_flag.sql` — SQL миграция

## Инструкция по применению миграции

Выполнить в Supabase SQL Editor:

```bash
# Или через CLI
psql -h <host> -U postgres -d postgres -f add_ai_generating_flag.sql
```

Или скопировать содержимое файла в Supabase Dashboard → SQL Editor.
