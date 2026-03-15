# 📦 Миграция: Хранение статов персонажей в сессии

**Дата:** 2026-03-15  
**Проблема:** Данные персонажа загружались из шаблона `characters`, а не из текущей сессии. При перезаходе отображались начальные статы, а не текущие.

---

## ✅ Что изменено

### 1. Источник правды
- **Было:** `characters` таблица — основной источник статов
- **Стало:** `game_sessions.character_stats` — основной источник статов

### 2. Инициализация
- При первом входе в сессию создаётся копия статов персонажа в `game_sessions.character_stats`
- При последующих входах загружаются данные из `game_sessions.character_stats`

### 3. Обновление статов
- AI отправляет `[STATS_UPDATE: {...}]` блок
- Система парсит изменения и обновляет `game_sessions.character_stats` через RPC функцию
- Realtime-подписка синхронизирует статы между всеми игроками

---

## 🔧 Применение миграции

### Шаг 1: Выполнить SQL миграцию

В **Supabase SQL Editor** выполнить:

```sql
-- Файл: fix_character_stats.sql
```

Скопируйте содержимое файла `fix_character_stats.sql` и выполните в Supabase.

### Шаг 2: Проверить структуру таблицы

Убедитесь, что `game_sessions` имеет поле `character_stats`:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'game_sessions';
```

Ожидаемый результат:
```
id              | text
lobby_id        | uuid
created_by      | text
created_at      | timestamptz
character_stats | jsonb
updated_at      | timestamptz
```

### Шаг 3: Проверить RPC функцию

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'update_character_stats_atomic';
```

### Шаг 4: Протестировать

1. Создайте нового персонажа
2. Начните новую игру
3. Отправьте сообщение AI
4. Проверьте, что AI ответил и статы обновились
5. Обновите страницу — статы должны сохраниться

---

## 📝 Изменения в коде

### `src/components/Chat.tsx`

**Исправлено:**
- Удалены `setTimeout` для инициализации статов
- `fetchRoomStats()` теперь сразу загружает данные из БД
- Если `character_stats` пуст — инициализируется из `character` props
- Удалено кэширование в `localStorage`

**Структура `CharacterStats`:**
```typescript
{
  name: string;
  race: string;
  class: string;
  level: number;
  hp: { current: number; max: number };
  xp: number;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  background: string;
  equipment: string[];
  story_summary?: string;
}
```

---

## 🎯 Поток данных

### Создание сессии
```
CharacterSelect → App.handleCreateLobby()
  → game_sessions.insert({ id, character_stats: {} })
  → Chat монтируется
  → fetchRoomStats()
  → character_stats пуст → инициализация из character
  → updateRoomStats() → RPC update_character_stats_atomic
  → game_sessions.character_stats = { "Арагорн": {...} }
```

### Обновление статов
```
AI отвечает с [STATS_UPDATE:{...}]
  → parseStatsChanges() парсит JSON
  → setCharacterStats() обновляет локальное состояние
  → updateRoomStats() вызывает RPC функцию
  → game_sessions.character_stats обновляется
  → postgres_changes триггерит подписку
  → Все игроки получают обновлённые статы
```

### Перезаход в сессию
```
Игрок вводит код сессии
  → App.joinSession()
  → Chat монтируется
  → fetchRoomStats()
  → character_stats не пуст → загрузка из БД
  → Отображаются ТЕКУЩИЕ статы (HP, XP, level, equipment)
```

---

## 🐛 Исправленные проблемы

| Проблема | Решение |
|----------|---------|
| При перезаходе статы сбрасываются | Данные хранятся в `game_sessions.character_stats` |
| Инвентарь не сохраняется | `equipment` массив обновляется в `character_stats` |
| Story summary теряется | `story_summary` сохраняется в `character_stats` |
| Гонка условий при инициализации | Удалены `setTimeout`, синхронная загрузка |

---

## 📊 Структура БД

```
┌──────────────────────┐
│ game_sessions        │
│──────────────────────│
│ id (TEXT) PK         │
│ character_stats      │ ← JSONB: { "Арагорн": {...}, "Гимли": {...} }
│ updated_at           │ ← Автообновление триггером
└──────────────────────┘
```

**Пример `character_stats`:**
```json
{
  "Арагорн": {
    "name": "Арагорн",
    "race": "Человек",
    "class": "Следопыт",
    "level": 3,
    "hp": { "current": 25, "max": 30 },
    "xp": 450,
    "stats": {
      "strength": 16,
      "dexterity": 14,
      "constitution": 13,
      "intelligence": 10,
      "wisdom": 12,
      "charisma": 15
    },
    "background": "Следопыт Севера",
    "equipment": ["Меч Андурил", "Плащ", "Зелье лечения"],
    "story_summary": "Победили гоблинов в пещере, нашли древний меч"
  }
}
```

---

## ✅ Чеклист после миграции

- [ ] SQL миграция выполнена
- [ ] RPC функция создана
- [ ] Триггер `updated_at` работает
- [ ] Новый персонаж создаётся корректно
- [ ] Статы обновляются после ответа AI
- [ ] При перезаходе статы сохраняются
- [ ] Инвентарь обновляется
- [ ] Story summary сохраняется
- [ ] Мультиплеер синхронизирует статы

---

**Готово!** 🚀
