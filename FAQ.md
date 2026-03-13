# ❓ FAQ - Часто задаваемые вопросы

## 🚀 Начало работы

### Нужно ли платить за использование?

**Да, но недорого:**
- OpenRouter: Pay-as-you-go, ~$0.016 за запрос
- Gemini: Бесплатно до 1500 запросов/день
- Supabase: Бесплатный tier (500MB БД, 2GB трафика)

**Итого:** $10 на OpenRouter хватит на ~600 запросов (несколько недель активной игры).

### Какие API ключи нужны?

1. **OpenRouter** (обязательно) - для Claude/GPT-4
2. **Google Gemini** (обязательно) - для суммаризации
3. **Supabase** (обязательно) - для хранения данных

### Можно ли использовать бесплатно?

**Частично:**
- Gemini бесплатный (1500 запросов/день)
- Можно использовать только Gemini Pro вместо Claude (дешевле)
- Или запустить локальную модель через Ollama

**Но:** OpenRouter платный, минимум $5 для начала.

---

## 💰 Стоимость и оптимизация

### Сколько стоит один запрос?

**С оптимизацией:**
- 10 сообщений: ~$0.006
- 30 сообщений: ~$0.012
- 50 сообщений: ~$0.016
- 100 сообщений: ~$0.025

**Без оптимизации:**
- 50 сообщений: ~$0.038 (в 2.4 раза дороже!)

### Как еще больше сэкономить?

1. **Используй Gemini Pro вместо Claude:**
   ```typescript
   mainModel: 'google/gemini-pro-1.5' // $1.25/$5 vs $3/$15
   ```

2. **Уменьши количество последних сообщений:**
   ```typescript
   recentHistoryCount: 5 // вместо 10
   ```

3. **Увеличь порог суммаризации:**
   ```typescript
   summarizeThreshold: 20 // вместо 15
   ```

4. **Уменьши длину ответа:**
   ```typescript
   maxTokens: 512 // вместо 1024
   ```

### Как отследить затраты?

- OpenRouter Dashboard: https://openrouter.ai/activity
- Gemini Quota: https://ai.google.dev/gemini-api/docs/quota
- Настрой алерты в OpenRouter на превышение бюджета

---

## 🤖 Модели и качество

### Какая модель лучше для RPG?

**Рекомендации:**

1. **Claude 3.5 Sonnet** ⭐ - лучший выбор
   - Самый креативный
   - Отлично понимает контекст
   - Хорошо следует правилам D&D
   - $3/$15 per 1M tokens

2. **GPT-4** - отличная альтернатива
   - Очень хороший для диалогов
   - Немного дороже ($30/$60)
   - Иногда более "формальный"

3. **Gemini Pro 1.5** - бюджетный вариант
   - Дешевле ($1.25/$5)
   - Хорошее качество
   - Может быть менее креативным

### Можно ли использовать несколько моделей?

**Да!** Создай несколько оркестраторов:

```typescript
const claudeOrchestrator = new AIOrchestrator({
  mainModel: 'anthropic/claude-3.5-sonnet',
  // ...
});

const gpt4Orchestrator = new AIOrchestrator({
  mainModel: 'openai/gpt-4',
  // ...
});

// Выбирай в зависимости от задачи
const response = isComplexScene 
  ? await claudeOrchestrator.processMessage(...)
  : await gpt4Orchestrator.processMessage(...);
```

### Как улучшить качество ответов?

1. **Увеличь temperature:**
   ```typescript
   temperature: 0.9 // больше креативности
   ```

2. **Увеличь maxTokens:**
   ```typescript
   maxTokens: 2048 // более длинные ответы
   ```

3. **Улучши System Prompt:**
   - Добавь больше примеров
   - Уточни стиль повествования
   - Добавь правила для конкретных ситуаций

4. **Используй Claude 3 Opus:**
   ```typescript
   mainModel: 'anthropic/claude-3-opus' // самый мощный
   ```

---

## 🔧 Технические вопросы

### Почему ответы медленные?

**Возможные причины:**

1. **Первый запрос** - суммаризация занимает время
   - Решение: нормально, последующие будут быстрее

2. **Большая история** - много токенов для обработки
   - Решение: уменьши `recentHistoryCount`

3. **Медленная модель** - GPT-4 медленнее Claude
   - Решение: используй `gpt-4-turbo` или Claude

4. **Rate limiting** - слишком много запросов
   - Решение: добавь задержку между запросами

### Ошибка "Rate limit exceeded"

**OpenRouter:**
- Проверь баланс: https://openrouter.ai/credits
- Пополни счет
- Подожди минуту

**Gemini:**
- Лимит: 15 запросов/минуту
- Подожди 1 минуту
- Или используй платный tier

### Ошибка "API key invalid"

1. Проверь `.env` файл
2. Убедись, что ключи правильные (без пробелов)
3. Перезапусти `npm run dev`
4. Проверь, что ключи активны в dashboard

### Как работает retry логика?

```typescript
// Автоматически повторяет при ошибках:
// - 429 (Rate limit)
// - 500/502/503 (Server errors)
// - Network errors

// Exponential backoff:
// Попытка 1: ждет 1 секунду
// Попытка 2: ждет 2 секунды
// Попытка 3: ждет 4 секунды
// После 3 попыток - выбрасывает ошибку
```

---

## 📊 Суммаризация

### Как работает суммаризация?

1. Когда история > 15 сообщений
2. Gemini Flash берет все старые сообщения (кроме последних 10)
3. Создает краткую сводку:
   - Описание путешествия
   - Ключевые NPC
   - Текущие квесты
   - Инвентарь
   - Важные события
4. Сводка добавляется в контекст вместо полной истории

### Можно ли отключить суммаризацию?

**Да:**

```typescript
const orchestrator = new AIOrchestrator({
  // ... другие настройки
});

// В ai-orchestrator.ts измени:
const SUMMARIZE_THRESHOLD = 999999; // никогда не суммаризировать
```

**Но:** это увеличит затраты в 2-3 раза!

### Теряется ли контекст при суммаризации?

**Минимально:**
- Сводка сохраняет ключевую информацию
- Последние 10 сообщений остаются полностью
- AI видит общую картину + детали недавних событий

**Если теряется:**
- Увеличь `recentHistoryCount` до 15
- Уменьши `summarizeThreshold` до 10
- Улучши промпт для суммаризации

---

## 🎮 Игровые механики

### Как обновляются характеристики персонажа?

AI автоматически добавляет JSON блок в конце ответа:

```json
{
  "type": "UPDATE_STATS",
  "stats": {
    "name": "Player Name",
    "hp": { "current": 25, "max": 30 },
    // ... остальные характеристики
  }
}
```

Система вырезает этот блок и обновляет UI.

### Можно ли играть вместе с друзьями?

**Да!** Multiplayer работает через Supabase Realtime:

1. Создай комнату
2. Поделись Room ID с друзьями
3. Все видят сообщения в реальном времени
4. AI ждет, пока все игроки ответят

### Как работают броски кубиков?

**Smart Dice:**
- Парсит последнее сообщение DM
- Находит формулу броска (например, `1d20+5`)
- Автоматически бросает нужные кубики
- Отправляет результат в чат

### Можно ли добавить картинки?

**Да!** Используй `generateImagePrompt()`:

```typescript
const prompt = await orchestrator.generateImagePrompt(
  messages,
  characterStats
);

// Отправь prompt в DALL-E / Midjourney
const image = await generateImage(prompt);
```

---

## 🛠️ Разработка

### Как добавить новую модель?

1. Добавь в `ai-config.ts`:
   ```typescript
   export const AI_MODELS = {
     MAIN: {
       // ...
       MY_MODEL: 'provider/model-name',
     }
   };
   ```

2. Добавь цены:
   ```typescript
   export const AI_PRICING = {
     'provider/model-name': { input: 1, output: 2 },
   };
   ```

3. Используй:
   ```typescript
   mainModel: AI_MODELS.MAIN.MY_MODEL
   ```

### Как добавить streaming?

**Пока не реализовано**, но можно добавить:

```typescript
// В ai-orchestrator.ts
export async function* generateResponseStream(
  config: AIConfig,
  context: ConversationContext
): AsyncGenerator<string> {
  const response = await fetch(/* ... */, {
    // ...
    body: JSON.stringify({
      // ...
      stream: true,
    })
  });
  
  const reader = response.body.getReader();
  // ... обработка stream
}
```

### Как добавить кэширование в localStorage?

```typescript
// Сохранение
localStorage.setItem(
  `summary_${roomId}`,
  JSON.stringify(cachedSummary)
);

// Загрузка
const cached = localStorage.getItem(`summary_${roomId}`);
if (cached) {
  this.cachedSummary = JSON.parse(cached);
}
```

---

## 🔒 Безопасность

### Безопасно ли хранить API ключи в .env?

**В development:** Да, `.env` не коммитится в git

**В production:** Используй переменные окружения:
- Vercel: Settings → Environment Variables
- Netlify: Site settings → Build & deploy → Environment

### Можно ли ограничить доступ к API?

**OpenRouter:**
- Настрой rate limits в dashboard
- Установи максимальный бюджет
- Используй разные ключи для dev/prod

**Gemini:**
- Ограничь по IP в Google Cloud Console
- Используй API restrictions

### Как защититься от злоупотреблений?

1. **Rate limiting на фронтенде:**
   ```typescript
   const MAX_REQUESTS_PER_MINUTE = 10;
   ```

2. **Лимит на длину сообщений:**
   ```typescript
   if (message.length > 1000) {
     throw new Error('Message too long');
   }
   ```

3. **Мониторинг затрат:**
   - Настрой алерты в OpenRouter
   - Проверяй usage ежедневно

---

## 📱 Deployment

### Как задеплоить на Vercel?

1. Push код на GitHub
2. Импортируй проект в Vercel
3. Добавь Environment Variables
4. Deploy!

### Как задеплоить на Netlify?

1. Push код на GitHub
2. New site from Git
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Добавь Environment Variables

### Нужен ли backend?

**Нет!** Всё работает на:
- Frontend: React (статика)
- Database: Supabase (managed)
- AI: OpenRouter + Gemini (API)

---

## 🆘 Помощь

### Где получить помощь?

1. Прочитай документацию:
   - [AI_SETUP.md](AI_SETUP.md)
   - [MIGRATION.md](MIGRATION.md)
   - [ARCHITECTURE.md](ARCHITECTURE.md)

2. Проверь [CHECKLIST.md](CHECKLIST.md)

3. Открой issue на GitHub

4. Напиши в чат поддержки

### Как сообщить о баге?

1. Открой issue на GitHub
2. Опиши проблему
3. Приложи:
   - Логи из консоли
   - Шаги для воспроизведения
   - Версию Node.js
   - Версию браузера

### Как предложить улучшение?

1. Открой issue с тегом "enhancement"
2. Опиши, что хочешь улучшить
3. Объясни, зачем это нужно
4. Предложи реализацию (опционально)

---

**Не нашел ответ?** Открой issue или напиши в чат!
