# 🐉 D&D DARK FANTASY RPG

Кооперативный ИИ Мастер Подземелий в сеттинге тёмного фэнтези.

---

## 🚀 Быстрый старт

### 1. Настройка
```bash
npm install
```

### 2. Настрой .env
Скопируй `.env.example` в `.env` и заполни:
```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_OPENROUTER_API_KEY=your-api-key
```

### 3. База данных
Выполни SQL миграцию в Supabase SQL Editor:
```
migration_2026_03_14_clean_slate.sql
```

### 4. Запуск
```bash
npm run dev
```

---

## 🎮 Как играть

### Одиночная игра
1. **Создать новую игру** → Выбор персонажа → Игра

### Мультиплеер
1. **Хост:** Создать лобби → Скопировать код
2. **Игрок:** Ввести код → Выбрать персонажа → Готов
3. **Хост:** Начать игру

### Возврат в игру
1. Ввести код сессии в главном меню

---

## 📚 Документация

- **Полная:** `MIGRATION_2026_03_14.md`
- **Краткая:** `CHANGELOG_SHORT.md`

---

## 🤖 AI Модели

| Роль | Модель | Задача |
|------|--------|--------|
| DM | Claude Sonnet 4.6 | Сюжет, боевые сцены |
| Parser | Gemini 2.5 Flash | Извлечение статов |
| Summary | Gemini 2.5 Flash | Обновление истории |

---

## 🛠️ Технологии

- **Frontend:** React + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Realtime)
- **AI:** OpenRouter (Claude, Gemini)
- **Стили:** Tailwind CSS + Motion

---

## 📦 Структура проекта

```
dnd-676/
├── src/
│   ├── components/
│   │   ├── Chat.tsx          # Основной игровой экран
│   │   ├── CharacterSelect.tsx
│   │   └── LobbyRoom.tsx
│   ├── lib/
│   │   ├── ai-orchestrator.ts
│   │   ├── ai-config.ts
│   │   └── supabase.ts
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
├── migration_2026_03_14_clean_slate.sql
├── CHANGELOG_SHORT.md
└── MIGRATION_2026_03_14.md
```

---

## 🔧 Команды

```bash
npm run dev      # Запуск разработки
npm run build    # Сборка продакшена
npm run preview  # Предпросмотр сборки
```

---

## 📝 Чеклист перед запуском

- [ ] SQL миграция выполнена
- [ ] `.env` заполнен
- [ ] `npm install` прошёл без ошибок
- [ ] Локальный запуск работает
- [ ] Персонаж создаётся
- [ ] Лобби работает
- [ ] Статы обновляются

---

## 🐛 Проблемы?

Смотри консоль браузера (F12) и логи Supabase.

Основные ошибки:
- **"session not found"** → сессия не создана в БД
- **Карточки не обновляются** → нет подписки на `characters`
- **AI не отвечает** → проверить API ключ OpenRouter

---

**Coded by fuserone1**
