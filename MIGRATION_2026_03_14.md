# 🎯 MIGRATION 2026-03-14: Новая архитектура сессий

## ✅ ЧТО СДЕЛАНО

### 1. База данных

**Файл:** `migration_2026_03_14_clean_slate.sql`

**Изменения:**
- ❌ Удалены все старые данные (полный сброс)
- ❌ Удалена таблица `rooms.character_stats`, `rooms.is_ai_generating`
- ✅ Создана таблица `game_sessions` (вместо `rooms`)
- ✅ Создана таблица `game_session_participants` (связь игроков с сессией)
- ✅ `messages.session_id` → `game_sessions.id` (вместо `room_id`)
- ✅ `characters` — единственный источник правды для статов
- ✅ Индексы для производительности
- ✅ RLS политики безопасности
- ✅ Функции для переноса из лобби в сессию

---

### 2. Типы данных

**Файл:** `src/types.ts`

**Новые типы:**
```typescript
interface GameSession {
  id: string; // Короткий код (например "A1B2C3")
  lobby_id?: string;
  created_by: string;
  created_at: string;
}

interface GameSessionParticipant {
  id: string;
  session_id: string;
  character_id: string;
  user_session_id: string;
  joined_at: string;
  character?: Character;
}
```

**Устаревшие типы (не использовать):**
- `Room` → использовать `GameSession`
- `CharacterStats` → использовать `Character` напрямую

---

### 3. AI Orchestrator

**Файл:** `src/lib/ai-orchestrator.ts`

**Новые методы:**

#### `parseStatsChanges(aiResponse: string)`
Парсит изменения статов из ответа DM через Gemini Flash.

```typescript
const result = await orchestrator.parseStatsChanges(aiResponse, characterStats);
// result.changes = [
//   {
//     characterName: "Арагорн",
//     hp: { current: 7, max: 10, change: -3 },
//     xp: { current: 50, change: 50 },
//     level: { current: 2, previous: 1 },
//     story_summary: "Победили гоблина в пещере"
//   }
// ]
```

#### `updateStorySummary(currentSummary, newEvent, aiResponse)`
Обновляет краткую сводку истории через Gemini Flash.

```typescript
const newSummary = await orchestrator.updateStorySummary(
  storySummary,
  "Победа над гоблином",
  aiResponse
);
```

---

### 4. App.tsx

**Изменения:**
- ✅ `roomId` → `sessionId`
- ✅ `rooms` → `game_sessions`
- ✅ `createRoom()` → `createSession()`
- ✅ `joinRoom()` → `joinSession()`
- ✅ Обработка `?session=XXX` из URL
- ✅ Поддержка лобби и сессий

**Поток:**
```
Главное меню
  ↓
[Создать лобби] → CharacterSelect → LobbyRoom → [Старт] → Chat
  ↓
[Одиночная игра] → CharacterSelect → Chat (сразу)
```

---

### 5. Chat.tsx

**Полностью переписан:**

**Изменения:**
- ✅ `roomId` → `sessionId`
- ✅ Загрузка персонажей через `game_session_participants JOIN characters`
- ✅ Подписка на `characters` (realtime обновления)
- ✅ UI виджет со статами (справа сверху)
- ✅ Интеграция с `parseStatsChanges()`
- ✅ Убран парсинг `[STATS_UPDATE:{...}]`
- ✅ AI не пишет JSON — только текст

**UI виджет:**
```
┌─────────────────┐
│ ⚔️ Арагорн      │
│ ❤️ 7/10         │
│ ⭐ XP: 50/300   │
│ 🎯 Ур. 1        │
│ ─────────────── │
│ Характеристики  │
│ Сила 15 (+2)    │
│ Ловкость 12 (+1)│
│ ...             │
└─────────────────┘
```

---

### 6. LobbyRoom.tsx

**Обновлена функция `handleStartGame()`:**

```typescript
// 1. Обновляем лобби
lobbies.update({ started_at, is_active: false })

// 2. Создаём сессию
game_sessions.insert({ id: sessionId, lobby_id, created_by })

// 3. Переносим участников
game_session_participants.insert(...)

// 4. Переход в игру
window.location.href = `/?session=${sessionId}`
```

---

## 🔄 ПОТОК ДАННЫХ

### Создание персонажа
```
Игрок → CharacterSelect → characters.insert() → персонаж создан
```

### Создание лобби
```
Хост → App.handleCreateLobby() → lobbies.insert()
Хост → выбирает персонажа → lobby_participants.insert()
```

### Присоединение к лобби
```
Игрок 2 → App.handleJoinLobby() → lobby_participants.insert()
```

### Старт игры
```
Хост → LobbyRoom.handleStartGame()
  1. lobbies.update(started_at, is_active=false)
  2. game_sessions.insert(id=короткий_код)
  3. game_session_participants.insert() для всех
  4. window.location.href = `/?session=XXX`
```

### Загрузка персонажей
```
Chat монтируется →
  fetchSessionParticipants() →
    game_session_participants JOIN characters →
  setCharacterStats() →
  Подписка на characters (WHERE id IN [...])
```

### Отправка сообщения
```
Игрок → sendMessage() → messages.insert()
  ↓
generateAIResponse() →
  1. Claude: генерирует атмосферный ответ
  2. Gemini Flash: parseStatsChanges() → извлекает HP/XP/level
  3. characters.update() для каждого персонажа
  4. Gemini Flash: updateStorySummary()
  ↓
messages.insert() с AI ответом
  ↓
postgres_changes → все игроки получают обновление
```

### Синхронизация статов
```
characters.update() →
  postgres_changes (UPDATE на characters) →
    Все игроки подписаны →
    setCharacterStats() у всех →
    Карточки обновляются realtime
```

---

## 🎮 ИГРОВОЙ ПРОЦЕСС

### 1. Одиночная игра
```
Главное меню → "Создать новую игру" → Выбор персонажа → Chat
```

### 2. Мультиплеер (лобби)
```
Хост: "Создать лобби" → Выбор персонажа → Ожидание
Игрок 2: Ввод кода → Выбор персонажа → Готовность
Хост: "Начать игру" → Создание сессии → Chat
```

### 3. Возврат в сессию
```
Главное меню → Ввод кода сессии → Chat (с сохранённой историей)
```

---

## 🤖 AI АРХИТЕКТУРА

| Роль | Модель | Задача | Время |
|------|--------|--------|-------|
| **DM (Narrator)** | Claude Sonnet 4.6 | Атмосферный ответ, сюжет, боевые сцены | 10-30 сек |
| **Stats Parser** | Gemini 2.5 Flash | Парсит ответ DM, извлекает HP/XP/level | 1-3 сек |
| **Summary Updater** | Gemini 2.5 Flash | Обновляет story_summary | 1-2 сек |
| **Image Prompt** | Gemini 2.5 Flash | Генерирует промпт для изображения | 1-2 сек |
| **Image Generator** | Riverflow V2 | Создаёт изображение | 5-10 сек |

**Оптимизация:**
- Claude отвечает → показываем игроку → Gemini парсит асинхронно
- Не блокировать UI на время парсинга
- Summary обновляется раз в N сообщений (кэширование)

---

## 📊 БАЗА ДАННЫХ

### Схема

```
┌──────────────────────┐
│ characters           │ ← Единственный источник правды
│──────────────────────│
│ id (UUID)            │
│ name (TEXT UNIQUE)   │
│ hp_current, hp_max   │
│ xp, level            │
│ stats (INT)          │
│ story_summary (TEXT) │
└──────────────────────┘
           ↑
           │
┌──────────────────────┐
│ game_session_        │
│ participants         │
│──────────────────────│
│ session_id (TEXT)    │
│ character_id (UUID)  │
│ user_session_id      │
└──────────────────────┘
           ↑
           │
┌──────────────────────┐
│ game_sessions        │
│──────────────────────│
│ id (TEXT) PK         │
│ lobby_id (UUID)      │
│ created_by           │
└──────────────────────┘

┌──────────────────────┐
│ messages             │
│──────────────────────│
│ session_id (TEXT) FK │
│ sender_id            │
│ content              │
│ is_ai                │
└──────────────────────┘
```

### Индексы

```sql
idx_game_sessions_lobby ON game_sessions(lobby_id)
idx_game_session_participants_session ON game_session_participants(session_id)
idx_game_session_participants_character ON game_session_participants(character_id)
idx_messages_session ON messages(session_id)
idx_messages_session_created ON messages(session_id, created_at DESC)
```

---

## 🧪 ТЕСТИРОВАНИЕ

### Чеклист

- [ ] **Создание персонажа**
  - [ ] Персонаж сохраняется в БД
  - [ ] Все статы корректны

- [ ] **Создание лобби**
  - [ ] Лобби создаётся
  - [ ] Код копируется

- [ ] **Присоединение к лобби**
  - [ ] Игрок 2 видит лобби
  - [ ] Персонаж выбирается

- [ ] **Старт игры**
  - [ ] Создаётся `game_sessions`
  - [ ] Переносятся участники
  - [ ] Переход в Chat

- [ ] **Отправка сообщения**
  - [ ] Сообщение сохраняется
  - [ ] AI отвечает
  - [ ] Индикатор "Мастер плетет историю..." виден

- [ ] **Обновление статов**
  - [ ] Gemini Flash парсит изменения
  - [ ] `characters.update()` работает
  - [ ] Виджет обновляется realtime

- [ ] **Синхронизация**
  - [ ] Игрок 1 видит статы Игрока 2
  - [ ] Обновления realtime у всех

- [ ] **Возврат в сессию**
  - [ ] Код сессии работает
  - [ ] История загружается
  - [ ] Статы корректны

---

## 🗂️ УДАЛЁННЫЕ ФАЙЛЫ

Можно удалить старую документацию:
- `AI_JSON_AND_STATS_SYNC_CHECK.md`
- `AI_LOADING_INDICATOR_SYNC.md`
- `AI_RESPONSE_TRUNCATION_FIX.md`
- `CHARACTER_REJOIN_FIX.md`
- `CHECK_DATABASE.sql`
- `FINAL_CHECKLIST.md`
- `FINAL_FIX_SUMMARY.md`
- `JSON_NOTIFICATION_FIX.md`
- `add_ai_generating_flag.sql`

---

## 📝 СЛЕДУЮЩИЕ ШАГИ

1. ✅ Применить SQL миграцию
2. ✅ Обновить код
3. ⏳ Протестировать локально
4. ⏳ Отправить на GitHub
5. ⏳ Протестировать на Vercel

---

## 🐛 ВОЗМОЖНЫЕ ПРОБЛЕМЫ

### Карточки не обновляются
**Причина:** Нет подписки на `characters`
**Решение:** Проверить консоль на `Character updated: ...`

### AI не отвечает
**Причина:** Нет API ключа или лимиты
**Решение:** Проверить `.env` и баланс OpenRouter

### Ошибка "session not found"
**Причина:** Сессия не создана или удалена
**Решение:** Проверить `game_sessions` в БД

### Лобби не стартует
**Причина:** Ошибка в `handleStartGame`
**Решение:** Проверить консоль на ошибки

---

## 🎯 ИТОГИ

| Компонент | Статус | Файл |
|-----------|--------|------|
| SQL миграция | ✅ | `migration_2026_03_14_clean_slate.sql` |
| Типы | ✅ | `src/types.ts` |
| AI Orchestrator | ✅ | `src/lib/ai-orchestrator.ts` |
| App | ✅ | `src/App.tsx` |
| Chat | ✅ | `src/components/Chat.tsx` |
| LobbyRoom | ✅ | `src/components/LobbyRoom.tsx` |
| CharacterSelect | ⏳ | Без изменений (работает) |

**Все изменения применены!** 🚀
