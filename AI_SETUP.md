# 🎮 Настройка AI Orchestrator для RPG

## 📋 Обзор архитектуры

Все модели работают через **OpenRouter** для максимальной совместимости:

```
┌─────────────────────────────────────────────────┐
│ Пользователь отправляет сообщение               │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ AI Orchestrator (через OpenRouter)              │
│                                                  │
│ 1. Проверяет: нужна ли суммаризация?           │
│    (если > 15 сообщений)                        │
│                                                  │
│ 2. Если да → Gemini 2.5 Flash                   │
│    Суммаризирует старые сообщения               │
│    (NPC, квесты, инвентарь, события)            │
│                                                  │
│ 3. Берет последние 10 сообщений                 │
│                                                  │
│ 4. Формирует запрос:                            │
│    [System Prompt]                               │
│    [Global Summary]                              │
│    [Recent 10 messages]                          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ OpenRouter → Claude Sonnet 4.6                  │
│ Генерирует ответ DM                             │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ Ответ отправляется игроку                       │
└─────────────────────────────────────────────────┘
```

## 🔑 Модели

| Назначение | Модель | OpenRouter ID |
|------------|--------|---------------|
| **Основная** | Claude Sonnet 4.6 | `anthropic/claude-sonnet-4.6` |
| **Рабочая лошадка** | Gemini 2.5 Flash | `google/gemini-2.5-flash` |
| **Картинки** | GPT-5 Image Mini | `openai/gpt-5-image-mini` |

## 🔑 Получение API ключей

### OpenRouter (единый ключ для всех моделей)

1. Зарегистрируйся на [openrouter.ai](https://openrouter.ai/)
2. Пополни баланс ($5-10 хватит надолго)
3. Создай API ключ в [Keys & Settings](https://openrouter.ai/keys)
4. Скопируй ключ в `.env`:
   ```
   VITE_OPENROUTER_API_KEY=sk-or-v1-xxxxx
   ```

**Преимущества:**
- ✅ Один ключ для всех моделей
- ✅ Автоматическая маршрутизация запросов
- ✅ Единая статистика расходов
- ✅ Поддержка всех провайдеров (Anthropic, Google, OpenAI)

## 📦 Установка

1. Скопируй `.env.example` в `.env`:
   ```bash
   cp .env.example .env
   ```

2. Заполни ключи в `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_OPENROUTER_API_KEY=sk-or-v1-xxxxx
   ```

3. Установи зависимости (если еще не установлены):
   ```bash
   npm install
   ```

## 🚀 Интеграция в Chat.tsx

### Вариант 1: Быстрая интеграция

Замени функцию `triggerAIResponse` в `Chat.tsx`:

```typescript
import { AIOrchestrator } from '../lib/ai-orchestrator';
import { AI_MODELS } from '../lib/ai-config';

// В начале компонента
const orchestratorRef = useRef<AIOrchestrator | null>(null);

// В useEffect (инициализация)
useEffect(() => {
  orchestratorRef.current = new AIOrchestrator({
    mainModel: AI_MODELS.MAIN,           // anthropic/claude-sonnet-4.6
    summaryModel: AI_MODELS.WORKHORSE,   // google/gemini-2.5-flash
    imageModel: AI_MODELS.IMAGE,         // openai/gpt-5-image-mini
    openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
    httpReferer: window.location.origin,
    xTitle: 'D&D Dark Fantasy RPG',
  });
}, []);

// Замени вызов Groq на:
const aiText = await orchestratorRef.current!.processMessage(
  SYSTEM_PROMPT,
  rpHistory,
  characterStats || {}
);
```

### Вариант 2: Использование готовых функций

```typescript
import { 
  AIOrchestrator, 
  generateImage,
  generateImagePrompt 
} from '../lib/ai-orchestrator';
import { AI_MODELS } from '../lib/ai-config';

// Генерация изображения
const orchestrator = new AIOrchestrator({
  mainModel: AI_MODELS.MAIN,
  summaryModel: AI_MODELS.WORKHORSE,
  imageModel: AI_MODELS.IMAGE,
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
});

// Способ 1: Полная генерация из сообщений
const result = await orchestrator.generateImageFromMessages(
  messages,
  characterStats
);

if (result.imageUrl) {
  console.log('Изображение:', result.imageUrl);
}

// Способ 2: Отдельная генерация промпта и изображения
const prompt = await orchestrator.generateImagePrompt(messages, characterStats);
const imageResult = await generateImage(prompt, apiKey, AI_MODELS.IMAGE);
```

## 💰 Стоимость

### Основная модель (Claude Sonnet 4.6)
- **Вход:** $3 / 1M токенов
- **Выход:** $15 / 1M токенов

### Рабочая лошадка (Gemini 2.5 Flash)
- **Вход:** $0.075 / 1M токенов
- **Выход:** $0.3 / 1M токенов

### Картинки (GPT-5 Image Mini)
- **Цена:** За изображение (уточнять на openrouter.ai)

### Пример расчета на 1000 запросов

**Без оптимизации:**
- 50 сообщений × 200 символов = 10,000 символов ≈ 2,500 токенов
- Claude: 2,500 × $3/1M = $0.0075 вход + 500 × $15/1M = $0.0075 выход
- **$0.015 за запрос → $15 на 1000 запросов**

**С оптимизацией:**
- Gemini Flash суммаризует 40 сообщений → 500 токенов
- Claude получает: 500 (сводка) + 2,000 (10 последних) = 2,500 токенов
- Gemini: 500 × $0.075/1M = $0.0000375
- Claude: 2,500 × $3/1M = $0.0075
- **$0.0075 за запрос → $7.50 на 1000 запросов**

**Экономия: 50% (~$7.50 на 1000 запросов)** 🎉

## 🔧 Настройка параметров

### Изменить основную модель

В `ai-config.ts`:

```typescript
export const AI_MODELS = {
  MAIN: 'anthropic/claude-sonnet-4.6',  // ← Поменять здесь
  // или
  MAIN: 'anthropic/claude-3.5-sonnet',  // Альтернатива
  // или
  MAIN: 'openai/gpt-4',                 // Другая альтернатива
}
```

### Изменить порог суммаризации

В `ai-orchestrator.ts`:

```typescript
const SUMMARIZE_THRESHOLD = 15; // Суммаризировать после 15 сообщений
```

Меньше = чаще суммаризация = больше экономия, но больше запросов к Workhorse

### Изменить количество последних сообщений

```typescript
const RECENT_HISTORY_COUNT = 10; // Последние 10 сообщений
```

Больше = лучше контекст, но дороже

## 🐛 Отладка

### Проверка ключей

```typescript
console.log('OpenRouter Key:', import.meta.env.VITE_OPENROUTER_API_KEY?.slice(0, 10));
```

### Логирование запросов

В `ai-orchestrator.ts` добавь:

```typescript
console.log('Sending to OpenRouter:', {
  model: config.mainModel,
  messageCount: messages.length,
  totalTokens: JSON.stringify(messages).length / 4, // Примерно
});
```

### Тестирование суммаризации

```typescript
const summary = await summarizeHistory(messages, openRouterApiKey, summaryModel);
console.log('Summary:', summary);
```

## ❓ FAQ

**Q: Можно ли использовать только одну модель?**  
A: Да, установи `mainModel` и `summaryModel` в одно значение, но не будет экономии.

**Q: Какая модель лучше для RPG?**  
A: Claude Sonnet 4.6 - самый креативный и понимает контекст лучше всех.

**Q: Сколько стоит OpenRouter?**  
A: Pay-as-you-go. Пополняй баланс по мере необходимости. Статистика на [dashboard](https://openrouter.ai/activity).

**Q: Что делать при ошибке 429?**  
A: Rate limit. Система автоматически повторит запрос через 1-2-4 секунды (exponential backoff).

**Q: Можно ли использовать для генерации картинок?**  
A: Да! Используй `orchestrator.generateImageFromMessages()` для полной генерации или `orchestrator.generateImagePrompt()` для создания промпта.

**Q: Зачем нужен OpenRouter?**  
A: Единый API для всех провайдеров, автоматическая маршрутизация, общая статистика, проще управление ключами.

## 📊 Мониторинг использования

OpenRouter показывает статистику на [dashboard](https://openrouter.ai/activity):
- Количество запросов
- Потраченные токены
- Расходы по моделям
- Лимиты и квоты

## 🎯 Следующие шаги

1. ✅ Получи API ключ OpenRouter
2. ✅ Настрой `.env`
3. ✅ Интегрируй в `Chat.tsx`
4. ✅ Протестируй с 20+ сообщениями
5. ✅ Проверь логи суммаризации
6. ✅ Протестируй генерацию изображений
7. ✅ Наслаждайся экономией! 💰

---

**Нужна помощь?** Открой issue или спроси в чате!
