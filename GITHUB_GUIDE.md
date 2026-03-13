# 📦 Что заливать на GitHub

## ✅ Файлы для коммита

### Обязательно:
- ✅ `src/` - весь исходный код
- ✅ `public/` - статические файлы
- ✅ `package.json` - зависимости
- ✅ `package-lock.json` -.lock файл для консистентности
- ✅ `tsconfig.json` - конфигурация TypeScript
- ✅ `index.html` - главный HTML
- ✅ `vite.config.ts` - конфигурация Vite
- ✅ `.env.example` - пример переменных окружения
- ✅ `.gitignore` - игнорирование файлов
- ✅ `README.md` - документация
- ✅ `*.md` - документация (AI_SETUP.md, CHEATSHEET.md, и т.д.)

### Опционально (документация):
- ✅ `AI_CONFIG_UPDATE.md`
- ✅ `AI_SETUP.md`
- ✅ `CHEATSHEET.md`
- ✅ `ARCHITECTURE.md`
- ✅ `FAQ.md`
- ✅ другие `.md` файлы

---

## ❌ НЕ заливать на GitHub

### Секретные файлы:
- ❌ `.env` - содержит API ключи
- ❌ `.env.local` - локальные переменные
- ❌ `.env.production` - продакшен ключи

### Зависимости и билд:
- ❌ `node_modules/` - устанавливаются через `npm install`
- ❌ `build/` - результат билда
- ❌ `dist/` - результат компиляции
- ❌ `coverage/` - отчеты тестов

### Системные файлы:
- ❌ `.DS_Store` (macOS)
- ❌ `Thumbs.db` (Windows)
- ❌ `*.log` - логи

### IDE:
- ❌ `.vscode/` (кроме settings.json если нужен)
- ❌ `.idea/`
- ❌ `*.iml`

### Временные файлы:
- ❌ `.cache/`
- ❌ `*.tmp`
- ❌ `*.bak`

---

## 🚀 Быстрый старт на GitHub

### 1. Создай репозиторий на GitHub
```bash
# Не создавай с README - будет конфликт
```

### 2. Инициализируй Git (если еще нет)
```bash
git init
git add .
git commit -m "Initial commit: D&D Dark Fantasy RPG"
```

### 3. Добавь удаленный репозиторий
```bash
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```

### 4. Для последующих коммитов
```bash
git add .
git commit -m "Description of changes"
git push
```

---

## 🔒 Безопасность

### Перед первым коммитом проверь:
```bash
# Показать какие файлы будут закоммичены
git status

# Показать что в .env (убедись что нет реальных ключей)
cat .env.example
```

### Если случайно закоммитил .env:
```bash
# Удалить из истории Git (но ключи уже скомпрометированы!)
git rm --cached .env
git commit -m "Remove .env from tracking"
git push

# СРОЧНО смени API ключи!
```

---

## 📁 Структура репозитория

```
dnd-676/
├── 📁 src/                    ✅ Исходный код
│   ├── components/           ✅ React компоненты
│   ├── lib/                  ✅ Утилиты (AI, Supabase)
│   ├── types.ts              ✅ TypeScript типы
│   └── App.tsx               ✅ Главный компонент
├── 📁 public/                 ✅ Статика
├── 📄 package.json           ✅ Зависимости
├── 📄 tsconfig.json          ✅ TypeScript конфиг
├── 📄 vite.config.ts         ✅ Vite конфиг
├── 📄 index.html             ✅ HTML шаблон
├── 📄 .env.example           ✅ Пример переменных
├── 📄 .gitignore             ✅ Игнорирование
├── 📄 AI_SETUP.md            ✅ Документация AI
├── 📄 CHEATSHEET.md          ✅ Шпаргалка
├── 📄 README.md              ✅ Основная документация
└── 📁 docs/ (опционально)    ✅ Дополнительная документация
```

---

## 💡 Советы

### 1. Коммить часто
```bash
git add .
git commit -m "Fix: AI image generation"
git push
```

### 2. Используй понятные сообщения
- ✅ `feat: Add image generation`
- ✅ `fix: Character stats not updating`
- ✅ `docs: Update AI_SETUP.md`
- ❌ `update`
- ❌ `fix stuff`

### 3. Ветки для фич
```bash
git checkout -b feature/image-generation
# работа...
git commit -m "feat: Add image generation"
git push origin feature/image-generation
# создай Pull Request на GitHub
```

### 4. .env файл для локальной разработки
```bash
# Скопируй пример
cp .env.example .env

# Заполни своими ключами
VITE_OPENROUTER_API_KEY=sk-or-v1-...
VITE_SUPABASE_URL=...
```

---

## 🎯 Чеклист перед пушем

- [ ] Проверил `git status` - нет ли `.env`
- [ ] Протестировал локально (`npm run dev`)
- [ ] Нет ошибок TypeScript (`npm run build`)
- [ ] Все коммиты с понятными сообщениями
- [ ] Push в правильную ветку

---

**Готово!** 🚀 Теперь можно спокойно пушить на GitHub!
