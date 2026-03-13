# 🔄 Миграция с Groq на OpenRouter + Gemini

## Быстрый старт (5 минут)

### Шаг 1: Получи API ключи

1. **OpenRouter**: [openrouter.ai/keys](https://openrouter.ai/keys)
2. **Gemini**: [ai.google.dev](https://ai.google.dev/)

### Шаг 2: Обнови `.env`

```env
VITE_OPENROUTER_API_KEY=sk-or-v1-xxxxx
VITE_GEMINI_API_KEY=AIzaSyxxxxx
```

### Шаг 3: Замени код в `Chat.tsx`

Найди эту часть (строка ~40):

```typescript
import { Groq } from 'groq-sdk';
```

Замени на:

```typescript
import { AIOrchestrator } from '../lib/ai-orchestrator';
```

Найди инициализацию (после useState):

```typescript
const orchestratorRef = useRef<AIOrchestrator | null>(null);
```

В `useEffect` (после `fetchMessages()`):

```typescript
useEffect(() => {
  // ... существующий код ...
  
  // Добавь инициализацию оркестратора
  orchestratorRef.current = new AIOrchestrator({
    mainModel: 'anthropic/claude-3.5-sonnet',
    summaryModel: 'google/gemini-flash-1.5',
    openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    httpReferer: window.location.origin,
    xTitle: 'D&D Dark Fantasy RPG',
  });
}, [roomId]);
```

Найди функцию `triggerAIResponse` (строка ~400+), замени этот блок:

```typescript
// СТАРЫЙ КОД (удали):
const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

const response = await groq.chat.completions.create({
  model: "llama-3.1-8b-instant",
  messages: [
    { role: "system", content: SYSTEM_PROMPT + statsContext },
    ...chatHistory
  ],
  temperature: 0.7,
  max_tokens: 1024,
});

let aiText = response.choices[0]?.message?.content || "";
```

На:

```typescript
// НОВЫЙ КОД:
if (!orchestratorRef.current) {
  throw new Error('AI Orchestrator not initialized');
}

let aiText = await orchestratorRef.current.processMessage(
  SYSTEM_PROMPT + statsContext,
  rpHistory,
  characterStats || {}
);
```

### Шаг 4: Тестируй

```bash
npm run dev
```

Отправь 20+ сообщений и проверь консоль на наличие суммаризации.

## Что изменилось?

| Параметр | Groq (старое) | OpenRouter (новое) |
|----------|---------------|-------------------|
| Модель | llama-3.1-8b-instant | Claude 3.5 Sonnet |
| Контекст | Все сообщения | Сводка + последние 10 |
| Стоимость | Бесплатно (лимиты) | ~$0.016/запрос |
| Качество | Среднее | Отличное |
| Суммаризация | Нет | Да (Gemini Flash) |

## Проверка работы

1. Открой консоль браузера (F12)
2. Отправь сообщение
3. Должны увидеть:
   ```
   Sending to OpenRouter: { model: 'anthropic/claude-3.5-sonnet', ... }
   ```

## Откат на Groq

Если что-то пошло не так, просто верни старый код:

```typescript
const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
// ... старый код ...
```

## Частые проблемы

**Ошибка: "API key invalid"**
- Проверь `.env` файл
- Перезапусти `npm run dev`

**Ошибка: "Rate limit exceeded"**
- OpenRouter: пополни баланс
- Gemini: подожди минуту (15 запросов/мин)

**Ответы слишком медленные**
- Нормально для первых запросов (суммаризация)
- Последующие будут быстрее (кэш)

**Ответы хуже, чем с Groq**
- Попробуй другую модель: `'openai/gpt-4'`
- Увеличь `temperature` до 0.9

## Дополнительно

Полная документация: `AI_SETUP.md`
Примеры кода: `src/lib/ai-integration-example.ts`
Тесты: `src/lib/ai-test.ts`
