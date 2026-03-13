# ⚡ Quick Start - 5 минут до запуска

## 1️⃣ Получи API ключи (2 минуты)

### OpenRouter
1. Открой https://openrouter.ai/
2. Sign Up → Create Account
3. Add Credits → $5-10
4. Keys → Create New Key
5. Скопируй ключ: `sk-or-v1-xxxxx`

### Google Gemini
1. Открой https://ai.google.dev/
2. Get API Key → Create API Key
3. Скопируй ключ: `AIzaSyxxxxx`

## 2️⃣ Настрой проект (1 минута)

```bash
# Скопируй .env.example
cp .env.example .env

# Открой .env и вставь ключи
VITE_OPENROUTER_API_KEY=sk-or-v1-xxxxx
VITE_GEMINI_API_KEY=AIzaSyxxxxx
```

## 3️⃣ Интегрируй в Chat.tsx (2 минуты)

### Добавь импорт (строка ~15)
```typescript
import { AIOrchestrator } from '../lib/ai-orchestrator';
```

### Создай ref (после useState)
```typescript
const orchestratorRef = useRef<AIOrchestrator | null>(null);
```

### Инициализируй (в useEffect, после fetchMessages)
```typescript
useEffect(() => {
  fetchMessages();
  fetchRoomStats();
  
  // ДОБАВЬ ЭТО:
  orchestratorRef.current = new AIOrchestrator({
    mainModel: 'anthropic/claude-3.5-sonnet',
    summaryModel: 'google/gemini-flash-1.5',
    openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  });
  
  // ... остальной код
}, [roomId]);
```

### Замени Groq (в функции triggerAIResponse, строка ~400+)

**НАЙДИ:**
```typescript
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

**ЗАМЕНИ НА:**
```typescript
if (!orchestratorRef.current) {
  throw new Error('AI Orchestrator not initialized');
}

let aiText = await orchestratorRef.current.processMessage(
  SYSTEM_PROMPT + statsContext,
  rpHistory,
  characterStats || {}
);
```

## 4️⃣ Запусти (30 секунд)

```bash
npm run dev
```

Открой http://localhost:5173

## 5️⃣ Протестируй (1 минута)

1. Создай комнату
2. Отправь сообщение: "Я иду в таверну"
3. Дождись ответа AI
4. Отправь еще 20 сообщений
5. Проверь консоль - должна появиться суммаризация

## ✅ Готово!

Теперь у тебя:
- ✅ Claude 3.5 Sonnet для ответов
- ✅ Gemini Flash для суммаризации
- ✅ Экономия ~57% на токенах
- ✅ Автоматический retry при ошибках

## 🐛 Проблемы?

### "API key invalid"
```bash
# Проверь .env
cat .env

# Перезапусти
npm run dev
```

### "Rate limit exceeded"
- OpenRouter: пополни баланс
- Gemini: подожди 1 минуту

### Нет ответа от AI
1. Открой консоль (F12)
2. Проверь ошибки
3. Убедись, что ключи правильные

## 📚 Дальше

- [Полная инструкция](AI_SETUP.md)
- [Миграция с Groq](MIGRATION.md)
- [Конфигурации](CONFIGURATIONS.md)
- [FAQ](FAQ.md)

---

**Всё работает?** Поздравляю! 🎉

**Не работает?** Открой [CHECKLIST.md](CHECKLIST.md) для детальной проверки.
