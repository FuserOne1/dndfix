# ⚙️ Примеры конфигураций

## 🎯 Готовые конфигурации для разных сценариев

### 1. 💎 Премиум качество (рекомендуется)

**Для кого:** Хочешь лучшее качество, готов платить

```typescript
const orchestrator = new AIOrchestrator({
  mainModel: 'anthropic/claude-3.5-sonnet',
  summaryModel: 'google/gemini-flash-1.5',
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

// В ai-config.ts:
export const CONFIG = {
  temperature: 0.8,
  topP: 0.9,
  maxTokens: 1024,
  summarizeThreshold: 15,
  recentHistoryCount: 10,
};
```

**Стоимость:** ~$0.016/запрос
**Качество:** ⭐⭐⭐⭐⭐
**Скорость:** ⭐⭐⭐⭐

---

### 2. 💰 Бюджетный вариант

**Для кого:** Хочешь сэкономить, качество не критично

```typescript
const orchestrator = new AIOrchestrator({
  mainModel: 'google/gemini-pro-1.5',  // Дешевле Claude
  summaryModel: 'google/gemini-flash-1.5',
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export const CONFIG = {
  temperature: 0.8,
  topP: 0.9,
  maxTokens: 512,  // Короче ответы
  summarizeThreshold: 10,  // Чаще суммаризация
  recentHistoryCount: 5,  // Меньше контекста
};
```

**Стоимость:** ~$0.005/запрос (в 3 раза дешевле!)
**Качество:** ⭐⭐⭐
**Скорость:** ⭐⭐⭐⭐⭐

---

### 3. 🚀 Максимальная скорость

**Для кого:** Важна скорость ответа

```typescript
const orchestrator = new AIOrchestrator({
  mainModel: 'openai/gpt-4-turbo',  // Быстрее обычного GPT-4
  summaryModel: 'google/gemini-flash-1.5',
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export const CONFIG = {
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 512,  // Короткие ответы = быстрее
  summarizeThreshold: 20,  // Реже суммаризация
  recentHistoryCount: 5,  // Меньше токенов
};
```

**Стоимость:** ~$0.012/запрос
**Качество:** ⭐⭐⭐⭐
**Скорость:** ⭐⭐⭐⭐⭐

---

### 4. 🎨 Максимальная креативность

**Для кого:** Хочешь самые креативные и неожиданные ответы

```typescript
const orchestrator = new AIOrchestrator({
  mainModel: 'anthropic/claude-3-opus',  // Самый мощный
  summaryModel: 'google/gemini-flash-1.5',
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export const CONFIG = {
  temperature: 0.95,  // Максимальная креативность
  topP: 0.95,
  maxTokens: 2048,  // Длинные детальные ответы
  summarizeThreshold: 15,
  recentHistoryCount: 15,  // Больше контекста
};
```

**Стоимость:** ~$0.045/запрос (дорого!)
**Качество:** ⭐⭐⭐⭐⭐
**Скорость:** ⭐⭐⭐

---

### 5. 🎯 Сбалансированный

**Для кого:** Золотая середина между ценой и качеством

```typescript
const orchestrator = new AIOrchestrator({
  mainModel: 'openai/gpt-4',
  summaryModel: 'google/gemini-flash-1.5',
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export const CONFIG = {
  temperature: 0.8,
  topP: 0.9,
  maxTokens: 768,
  summarizeThreshold: 15,
  recentHistoryCount: 8,
};
```

**Стоимость:** ~$0.020/запрос
**Качество:** ⭐⭐⭐⭐
**Скорость:** ⭐⭐⭐⭐

---

### 6. 🆓 Максимально бесплатный

**Для кого:** Хочешь использовать только бесплатные ресурсы

```typescript
// Используй только Gemini (бесплатно до 1500 запросов/день)
const orchestrator = new AIOrchestrator({
  mainModel: 'google/gemini-pro-1.5',
  summaryModel: 'google/gemini-flash-1.5',
  openRouterApiKey: '', // Не нужен!
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export const CONFIG = {
  temperature: 0.8,
  topP: 0.9,
  maxTokens: 512,
  summarizeThreshold: 10,
  recentHistoryCount: 5,
};
```

**Стоимость:** $0 (до лимита)
**Качество:** ⭐⭐⭐
**Скорость:** ⭐⭐⭐⭐

**Лимиты Gemini:**
- 15 запросов/минуту
- 1500 запросов/день
- 1M токенов/день

---

### 7. 🏢 Production (надежность)

**Для кого:** Production приложение с высокой надежностью

```typescript
const orchestrator = new AIOrchestrator({
  mainModel: 'anthropic/claude-3.5-sonnet',
  summaryModel: 'google/gemini-flash-1.5',
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export const CONFIG = {
  temperature: 0.7,  // Более предсказуемо
  topP: 0.9,
  maxTokens: 1024,
  summarizeThreshold: 15,
  recentHistoryCount: 10,
  maxRetries: 5,  // Больше попыток
  retryDelayMs: 2000,  // Больше задержка
};

// Добавь мониторинг
const response = await orchestrator.processMessage(...)
  .catch(error => {
    // Логирование в Sentry/DataDog
    console.error('AI Error:', error);
    // Fallback на более дешевую модель
    return fallbackOrchestrator.processMessage(...);
  });
```

**Стоимость:** ~$0.016/запрос
**Качество:** ⭐⭐⭐⭐⭐
**Надежность:** ⭐⭐⭐⭐⭐

---

### 8. 🧪 Development/Testing

**Для кого:** Разработка и тестирование

```typescript
const orchestrator = new AIOrchestrator({
  mainModel: 'google/gemini-flash-1.5',  // Самый дешевый
  summaryModel: 'google/gemini-flash-1.5',
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export const CONFIG = {
  temperature: 0.5,  // Более предсказуемо для тестов
  topP: 0.9,
  maxTokens: 256,  // Короткие ответы
  summarizeThreshold: 5,  // Тестируем суммаризацию чаще
  recentHistoryCount: 3,
  maxRetries: 1,  // Быстрый fail
};
```

**Стоимость:** ~$0.001/запрос
**Качество:** ⭐⭐
**Скорость:** ⭐⭐⭐⭐⭐

---

## 🔄 Динамическое переключение

### По времени суток

```typescript
function getOrchestrator() {
  const hour = new Date().getHours();
  
  // Ночью (дешевая модель, меньше игроков)
  if (hour >= 0 && hour < 6) {
    return new AIOrchestrator({
      mainModel: 'google/gemini-pro-1.5',
      // ...
    });
  }
  
  // Днем (премиум модель, больше игроков)
  return new AIOrchestrator({
    mainModel: 'anthropic/claude-3.5-sonnet',
    // ...
  });
}
```

### По количеству игроков

```typescript
function getOrchestrator(playerCount: number) {
  // Соло - премиум качество
  if (playerCount === 1) {
    return premiumOrchestrator;
  }
  
  // Группа - бюджетный вариант
  return budgetOrchestrator;
}
```

### По сложности сцены

```typescript
async function generateResponse(message: string) {
  const isCombat = message.toLowerCase().includes('атак');
  const isDialog = message.toLowerCase().includes('говор');
  
  if (isCombat) {
    // Бой - нужна точность
    return await preciseOrchestrator.processMessage(...);
  } else if (isDialog) {
    // Диалог - нужна креативность
    return await creativeOrchestrator.processMessage(...);
  } else {
    // Обычная сцена
    return await defaultOrchestrator.processMessage(...);
  }
}
```

---

## 📊 Сравнительная таблица

| Конфигурация | Модель | Стоимость | Качество | Скорость | Для кого |
|--------------|--------|-----------|----------|----------|----------|
| Премиум | Claude 3.5 | $0.016 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Лучший опыт |
| Бюджет | Gemini Pro | $0.005 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Экономия |
| Скорость | GPT-4 Turbo | $0.012 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Быстрые ответы |
| Креатив | Claude Opus | $0.045 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Эпические истории |
| Баланс | GPT-4 | $0.020 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Золотая середина |
| Бесплатный | Gemini Pro | $0 | ⭐⭐⭐ | ⭐⭐⭐⭐ | Тестирование |
| Production | Claude 3.5 | $0.016 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Надежность |
| Dev/Test | Gemini Flash | $0.001 | ⭐⭐ | ⭐⭐⭐⭐⭐ | Разработка |

---

## 🎛️ Тонкая настройка параметров

### Temperature (креативность)

```typescript
temperature: 0.3  // Очень предсказуемо (для правил, механики)
temperature: 0.5  // Умеренно (для диалогов NPC)
temperature: 0.7  // Сбалансировано (по умолчанию)
temperature: 0.9  // Креативно (для описаний, сюжета)
temperature: 1.0  // Очень креативно (может быть хаотично)
```

### Top P (разнообразие)

```typescript
topP: 0.7  // Более фокусированно
topP: 0.9  // Сбалансировано (рекомендуется)
topP: 0.95 // Более разнообразно
```

### Max Tokens (длина ответа)

```typescript
maxTokens: 256   // Очень короткие ответы (1-2 абзаца)
maxTokens: 512   // Короткие ответы (2-3 абзаца)
maxTokens: 1024  // Средние ответы (3-5 абзацев)
maxTokens: 2048  // Длинные ответы (5-10 абзацев)
maxTokens: 4096  // Очень длинные (целая глава)
```

### Summarize Threshold

```typescript
summarizeThreshold: 5   // Очень часто (больше экономия)
summarizeThreshold: 10  // Часто
summarizeThreshold: 15  // Умеренно (рекомендуется)
summarizeThreshold: 20  // Редко
summarizeThreshold: 30  // Очень редко (лучше контекст)
```

### Recent History Count

```typescript
recentHistoryCount: 3   // Минимум (экономия)
recentHistoryCount: 5   // Мало
recentHistoryCount: 10  // Оптимально (рекомендуется)
recentHistoryCount: 15  // Много (лучше контекст)
recentHistoryCount: 20  // Максимум (дорого)
```

---

## 💡 Советы по выбору

### Выбирай Премиум, если:
- Хочешь лучший опыт
- Готов платить ~$15-20/месяц
- Играешь часто (каждый день)
- Важна атмосфера и погружение

### Выбирай Бюджет, если:
- Ограничен в средствах
- Играешь редко (1-2 раза в неделю)
- Тестируешь приложение
- Качество не критично

### Выбирай Скорость, если:
- Играешь с группой (ждать долго)
- Нужны быстрые ответы
- Много коротких сообщений
- Динамичный геймплей

### Выбирай Креатив, если:
- Эпическая кампания
- Важны детали и атмосфера
- Соло игра (не спешишь)
- Готов платить за качество

---

## 🔧 Как применить конфигурацию

1. Скопируй нужную конфигурацию
2. Вставь в `Chat.tsx` при инициализации
3. Обнови константы в `ai-config.ts`
4. Перезапусти `npm run dev`
5. Протестируй!

---

**Не знаешь, что выбрать?** Начни с **Премиум** конфигурации - она оптимальна для большинства случаев!
