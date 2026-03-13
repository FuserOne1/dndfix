# 🔑 Настройка AI через OpenRouter

## ✅ Что изменено

Все модели теперь работают через **единый API ключ OpenRouter**:

| Назначение | Модель | OpenRouter ID |
|------------|--------|---------------|
| **Основная** | Claude Sonnet 4.6 | `anthropic/claude-sonnet-4.6` |
| **Рабочая лошадка** | Gemini 2.5 Flash | `google/gemini-2.5-flash` |
| **Картинки** | GPT-5 Image Mini | `openai/gpt-5-image-mini` |

## 🚀 Быстрая настройка

### 1. Получи API ключ OpenRouter

1. Перейди на [openrouter.ai](https://openrouter.ai/)
2. Зарегистрируйся (Google/GitHub)
3. Пополни баланс (минимум $5)
4. Создай ключ на [Keys & Settings](https://openrouter.ai/keys)

### 2. Обнови .env

Скопируй `.env.example` и добавь ключ:

```bash
# Открой .env и добавь:
VITE_OPENROUTER_API_KEY=sk-or-v1-твой-ключ
```

**Важно:** Ключ Gemini больше не нужен!

### 3. Перезапусти сервер

```bash
npm run dev
```

## 📁 Обновленные файлы

- ✅ `src/lib/ai-config.ts` - конфигурация моделей
- ✅ `src/lib/ai-orchestrator.ts` - единый API для всех моделей
- ✅ `src/lib/ai-test.ts` - тесты через OpenRouter
- ✅ `src/lib/ai-integration-example.ts` - пример интеграции
- ✅ `.env.example` - удален GEMINI_API_KEY
- ✅ `AI_SETUP.md` - полная документация
- ✅ `CHEATSHEET.md` - шпаргалка

## 🧪 Тестирование

Открой консоль браузера и выполни:

```javascript
import { runAllTests } from './src/lib/ai-test';
runAllTests('sk-or-v1-твой-ключ');
```

## 💰 Стоимость

- **Claude Sonnet 4.6:** $3/1M вход, $15/1M выход
- **Gemini 2.5 Flash:** $0.075/1M вход, $0.3/1M выход
- **GPT-5 Image Mini:** цена за изображение

**Экономия с оптимизацией:** ~50%

## 🆘 Если что-то не работает

1. Проверь ключ в `.env`
2. Убедись, что баланс OpenRouter > 0
3. Проверь консоль на ошибки 401/403
4. Перезапусти `npm run dev`

## 📚 Документация

- Полная: [AI_SETUP.md](AI_SETUP.md)
- Шпаргалка: [CHEATSHEET.md](CHEATSHEET.md)
- Пример: [src/lib/ai-integration-example.ts](src/lib/ai-integration-example.ts)

---

**Готово!** Теперь все модели работают через один ключ 🎉
