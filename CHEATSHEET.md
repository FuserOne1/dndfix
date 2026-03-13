# 📋 Шпаргалка AI Orchestrator

## ⚡ Быстрая инициализация

```typescript
import { AIOrchestrator, AI_MODELS } from '../lib/ai-orchestrator';

const orchestrator = new AIOrchestrator({
  mainModel: AI_MODELS.MAIN,           // anthropic/claude-sonnet-4.6
  summaryModel: AI_MODELS.WORKHORSE,   // google/gemini-2.5-flash
  imageModel: AI_MODELS.IMAGE,         // openai/gpt-5-image-mini
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
  httpReferer: window.location.origin,
  xTitle: 'D&D Dark Fantasy RPG',
});
```

## 🎯 Основные методы

### Генерация ответа
```typescript
const response = await orchestrator.processMessage(
  systemPrompt,      // System prompt
  messages,          // Массив Message[]
  characterStats     // Record<string, CharacterStats>
);
```

### Генерация промпта для картинки
```typescript
const imagePrompt = await orchestrator.generateImagePrompt(
  messages,          // Последние сообщения
  characterStats     // Характеристики персонажей
);
```

### Генерация изображения
```typescript
const result = await orchestrator.generateImage(prompt);
// или
const result = await orchestrator.generateImageFromMessages(messages, characterStats);

if (result.imageUrl) {
  console.log('Изображение:', result.imageUrl);
}
```

### Очистка кэша
```typescript
orchestrator.clearCache();
```

## 🔧 Конфигурации моделей

### Основная (по умолчанию)
```typescript
MAIN: 'anthropic/claude-sonnet-4.6'     // ⭐ Лучший для RPG
```

### Рабочая лошадка
```typescript
WORKHORSE: 'google/gemini-2.5-flash'    // ⭐ Для суммаризации
```

### Картинки
```typescript
IMAGE: 'openai/gpt-5-image-mini'        // ⭐ Для генерации изображений
```

### Альтернативные
```typescript
ALTERNATIVES: {
  CLAUDE_35_SONNET: 'anthropic/claude-3.5-sonnet',
  GPT4: 'openai/gpt-4',
  GEMINI_PRO: 'google/gemini-pro-1.5',
}
```

## 📊 Доступные модели

### Основные (для ответов)
```typescript
'anthropic/claude-sonnet-4.6'   // ⭐ Рекомендуется (новый)
'anthropic/claude-3.5-sonnet'   // Отличная альтернатива
'openai/gpt-4'                  // Классика
'google/gemini-pro-1.5'         // Дешевле
```

### Суммаризация
```typescript
'google/gemini-2.5-flash'       // ⭐ Рекомендуется
'google/gemini-flash-1.5'       // Альтернатива
```

### Изображения
```typescript
'openai/gpt-5-image-mini'       // ⭐ Рекомендуется
```

## 💰 Цены (за 1M токенов)

| Модель | Input | Output |
|--------|-------|--------|
| Claude Sonnet 4.6 | $3 | $15 |
| Claude 3.5 Sonnet | $3 | $15 |
| GPT-4 | $30 | $60 |
| Gemini Pro 1.5 | $1.25 | $5 |
| Gemini 2.5 Flash | $0.075 | $0.3 |

## ⚙️ Параметры

### Temperature (креативность)
```typescript
0.3  // Предсказуемо
0.7  // Сбалансировано ⭐
0.8  // Креативно (по умолчанию)
0.9  // Очень креативно
```

### Max Tokens (длина)
```typescript
256   // Очень короткие
512   // Короткие
1024  // Средние ⭐ (по умолчанию)
2048  // Длинные
```

### Summarize Threshold
```typescript
10  // Часто суммаризировать
15  // Умеренно ⭐ (по умолчанию)
20  // Редко
```

### Recent History Count
```typescript
5   // Минимум
10  // Оптимально ⭐ (по умолчанию)
15  // Максимум
```

## 🐛 Обработка ошибок

```typescript
try {
  const response = await orchestrator.processMessage(...);
} catch (error: any) {
  if (error.message.includes('429')) {
    // Rate limit - подожди минуту
  } else if (error.message.includes('401')) {
    // Неверный API ключ
  } else if (error.message.includes('fetch')) {
    // Проблема с сетью
  }
}
```

## 📝 Типы

### Message
```typescript
interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  is_ai: boolean;
}
```

### CharacterStats
```typescript
interface CharacterStats {
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

### ImageGenerationResult
```typescript
interface ImageGenerationResult {
  imageUrl?: string;
  error?: string;
}
```

## 🔄 Retry логика

Автоматически повторяет при:
- 429 (Rate limit)
- 500/502/503 (Server errors)
- Network errors

Exponential backoff: 1s → 2s → 4s

## 💾 Кэширование

Сводки кэшируются автоматически:
- После первой суммаризации
- Обновляются каждые 5 новых сообщений
- Очищаются при `clearCache()`

## 📊 Оптимизация

### Экономия токенов
```typescript
// Уменьши контекст
recentHistoryCount: 5

// Чаще суммаризируй
summarizeThreshold: 10

// Короче ответы
maxTokens: 512
```

### Улучшение качества
```typescript
// Больше контекста
recentHistoryCount: 15

// Реже суммаризируй
summarizeThreshold: 20

// Длиннее ответы
maxTokens: 2048

// Больше креативности
temperature: 0.9
```

## 🔗 Полезные ссылки

- [OpenRouter Dashboard](https://openrouter.ai/activity)
- [OpenRouter Models](https://openrouter.ai/models)
- [Anthropic Docs](https://docs.anthropic.com/)
- [Google AI](https://ai.google.dev/)

## 🆘 Быстрая помощь

| Проблема | Решение |
|----------|---------|
| API key invalid | Проверь `.env`, перезапусти |
| Rate limit (429) | Подожди минуту |
| Медленно | Уменьши `maxTokens` |
| Плохое качество | Увеличь `temperature` |
| Дорого | Используй Gemini Pro |
| Нет контекста | Увеличь `recentHistoryCount` |
| Нет изображения | Проверь `imageModel` в конфиге |

## 📈 Метрики

### Стоимость на 1000 запросов (50 сообщений)

| Конфигурация | Стоимость |
|--------------|-----------|
| Без оптимизации (Claude) | ~$15.00 |
| С оптимизацией | ~$7.50 |
| **Экономия** | **~50%** |

### Скорость ответа

| Модель | Время ответа |
|--------|--------------|
| Gemini 2.5 Flash | ~2-3 сек ⭐ |
| Gemini Pro 1.5 | ~3-5 сек |
| GPT-4 Turbo | ~4-6 сек |
| Claude 3.5 | ~5-7 сек |
| Claude Sonnet 4.6 | ~5-7 сек |

## 🎯 Рекомендации

### Стандартная настройка
```typescript
{
  mainModel: 'anthropic/claude-sonnet-4.6',
  summaryModel: 'google/gemini-2.5-flash',
  imageModel: 'openai/gpt-5-image-mini',
  temperature: 0.8,
  maxTokens: 1024,
}
```

### Бюджетная
```typescript
{
  mainModel: 'google/gemini-pro-1.5',
  summaryModel: 'google/gemini-2.5-flash',
  temperature: 0.8,
  maxTokens: 512,
}
```

### Премиум
```typescript
{
  mainModel: 'anthropic/claude-sonnet-4.6',
  summaryModel: 'google/gemini-2.5-flash',
  temperature: 0.9,
  maxTokens: 2048,
}
```

---

**Все модели работают через OpenRouter!** 🔑  
Получи один ключ на [openrouter.ai/keys](https://openrouter.ai/keys)

**Сохрани эту шпаргалку!** 📌

Полная документация: [AI_SETUP.md](AI_SETUP.md)
