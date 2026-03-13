# 🏗️ Архитектура AI Orchestrator

## Общая схема

```mermaid
graph TB
    User[👤 Пользователь] -->|Отправляет сообщение| Chat[💬 Chat Component]
    Chat -->|Вызывает| Orchestrator[🎯 AI Orchestrator]
    
    Orchestrator -->|Проверяет историю| Decision{Больше 15<br/>сообщений?}
    
    Decision -->|Да| Summarize[📝 Суммаризация]
    Decision -->|Нет| Recent[📋 Последние 10]
    
    Summarize -->|Gemini Flash| GeminiAPI[🤖 Gemini API]
    GeminiAPI -->|Сводка 500 токенов| Context[📦 Контекст]
    
    Recent -->|Без изменений| Context
    
    Context -->|System Prompt +<br/>Summary +<br/>Recent 10| OpenRouter[🌐 OpenRouter]
    
    OpenRouter -->|Claude/GPT-4| MainModel[🧠 Основная модель]
    MainModel -->|Ответ DM| Response[💬 Ответ]
    
    Response -->|Сохраняет| Supabase[(🗄️ Supabase)]
    Response -->|Отображает| User
    
    style Orchestrator fill:#4ade80
    style GeminiAPI fill:#60a5fa
    style MainModel fill:#f59e0b
    style Supabase fill:#8b5cf6
```

## Поток данных

```mermaid
sequenceDiagram
    participant U as Пользователь
    participant C as Chat.tsx
    participant O as Orchestrator
    participant G as Gemini Flash
    participant R as OpenRouter
    participant S as Supabase
    
    U->>C: Отправляет сообщение
    C->>S: Сохраняет в БД
    C->>O: processMessage()
    
    alt История > 15 сообщений
        O->>G: Суммаризировать старые
        G-->>O: Сводка (500 токенов)
    end
    
    O->>O: Берет последние 10
    O->>O: Формирует контекст
    
    O->>R: POST /chat/completions
    R->>R: Выбирает модель
    
    alt Ошибка 429/500
        R-->>O: Ошибка
        O->>O: Ждет 1-2-4 сек
        O->>R: Повторный запрос
    end
    
    R-->>O: Ответ AI
    O-->>C: Возвращает текст
    C->>S: Сохраняет ответ
    C->>U: Отображает ответ
```

## Структура контекста

```mermaid
graph LR
    subgraph "Запрос к OpenRouter"
        A[System Prompt] --> B[Global Summary]
        B --> C[Recent Message 1]
        C --> D[Recent Message 2]
        D --> E[...]
        E --> F[Recent Message 10]
        F --> G[Current Message]
    end
    
    style A fill:#ef4444
    style B fill:#f59e0b
    style C fill:#4ade80
    style D fill:#4ade80
    style E fill:#4ade80
    style F fill:#4ade80
    style G fill:#60a5fa
```

## Суммаризация

```mermaid
graph TB
    subgraph "Без суммаризации"
        A1[50 сообщений] -->|10,000 токенов| B1[Claude]
        B1 -->|$0.038| C1[Ответ]
    end
    
    subgraph "С суммаризацией"
        A2[40 старых] -->|Gemini Flash| B2[Сводка 500т]
        A3[10 последних] -->|2,000 токенов| B2
        B2 -->|2,500 токенов| C2[Claude]
        C2 -->|$0.016| D2[Ответ]
    end
    
    style C1 fill:#ef4444
    style D2 fill:#4ade80
```

## Retry логика

```mermaid
graph TB
    Start[Запрос к API] --> Try{Попытка}
    
    Try -->|Успех| Success[✅ Возврат ответа]
    Try -->|Ошибка| Check{Тип ошибки?}
    
    Check -->|429/500/502/503| Retry{Попытка < 3?}
    Check -->|Другая| Error[❌ Выброс ошибки]
    
    Retry -->|Да| Wait[Ждать 2^n секунд]
    Retry -->|Нет| Error
    
    Wait --> Try
    
    style Success fill:#4ade80
    style Error fill:#ef4444
    style Wait fill:#f59e0b
```

## Кэширование сводок

```mermaid
graph LR
    subgraph "Первый запрос (20 сообщений)"
        A1[20 сообщений] -->|Суммаризация| B1[Сводка]
        B1 -->|Кэш| C1[Cache]
    end
    
    subgraph "Второй запрос (25 сообщений)"
        A2[5 новых] -->|Добавить к кэшу| C1
        C1 -->|Обновленная сводка| B2[Новая сводка]
    end
    
    subgraph "Третий запрос (30 сообщений)"
        A3[5 новых] -->|Добавить к кэшу| B2
        B2 -->|Обновленная сводка| C2[Финальная сводка]
    end
    
    style C1 fill:#60a5fa
    style B2 fill:#60a5fa
    style C2 fill:#4ade80
```

## Компоненты системы

```mermaid
graph TB
    subgraph "Frontend"
        Chat[Chat.tsx]
        Types[types.ts]
    end
    
    subgraph "AI Layer"
        Orchestrator[ai-orchestrator.ts]
        Config[ai-config.ts]
        Test[ai-test.ts]
    end
    
    subgraph "Backend"
        Supabase[Supabase Client]
        DB[(PostgreSQL)]
    end
    
    subgraph "External APIs"
        OpenRouter[OpenRouter API]
        Gemini[Gemini API]
    end
    
    Chat --> Orchestrator
    Chat --> Supabase
    Orchestrator --> Config
    Orchestrator --> OpenRouter
    Orchestrator --> Gemini
    Supabase --> DB
    
    style Orchestrator fill:#4ade80
    style OpenRouter fill:#f59e0b
    style Gemini fill:#60a5fa
    style DB fill:#8b5cf6
```

## Модели и их роли

```mermaid
graph LR
    subgraph "Основные модели"
        Claude[Claude 3.5 Sonnet<br/>$3/$15 per 1M]
        GPT4[GPT-4<br/>$30/$60 per 1M]
        Gemini[Gemini Pro 1.5<br/>$1.25/$5 per 1M]
    end
    
    subgraph "Суммаризация"
        Flash[Gemini Flash 1.5<br/>$0.075/$0.3 per 1M]
        GPT35[GPT-3.5 Turbo<br/>$0.5/$1.5 per 1M]
    end
    
    subgraph "Задачи"
        Main[Генерация ответов DM]
        Summary[Суммаризация истории]
        Image[Промпты для картинок]
    end
    
    Claude --> Main
    GPT4 --> Main
    Gemini --> Main
    
    Flash --> Summary
    Flash --> Image
    GPT35 --> Summary
    
    style Claude fill:#4ade80
    style Flash fill:#60a5fa
```

## Оптимизация токенов

```mermaid
pie title Распределение токенов (50 сообщений)
    "System Prompt" : 500
    "Global Summary" : 500
    "Recent 10 Messages" : 2000
    "Output" : 500
```

```mermaid
pie title Стоимость запроса
    "Суммаризация (Gemini)" : 10
    "Основной запрос (Claude)" : 90
```

## Обработка ошибок

```mermaid
graph TB
    Request[API Request] --> Error{Ошибка?}
    
    Error -->|429| RateLimit[Rate Limit]
    Error -->|401/403| Auth[Auth Error]
    Error -->|500/502/503| Server[Server Error]
    Error -->|Network| Network[Network Error]
    Error -->|Нет| Success[✅ Success]
    
    RateLimit --> Retry[Retry with backoff]
    Server --> Retry
    Network --> Retry
    
    Auth --> Fail[❌ Fail immediately]
    
    Retry --> Check{Попытка < 3?}
    Check -->|Да| Request
    Check -->|Нет| Fail
    
    style Success fill:#4ade80
    style Fail fill:#ef4444
    style Retry fill:#f59e0b
```

## Метрики производительности

```mermaid
graph LR
    subgraph "Без оптимизации"
        A1[10,000 токенов] -->|3ms/token| B1[30 секунд]
        B1 -->|$0.038| C1[Стоимость]
    end
    
    subgraph "С оптимизацией"
        A2[2,500 токенов] -->|3ms/token| B2[7.5 секунд]
        B2 -->|$0.016| C2[Стоимость]
    end
    
    style B1 fill:#ef4444
    style B2 fill:#4ade80
    style C1 fill:#ef4444
    style C2 fill:#4ade80
```

---

## Легенда

- 🟢 Зеленый - Оптимизированные компоненты
- 🔵 Синий - Внешние сервисы
- 🟠 Оранжевый - Основные модели
- 🟣 Фиолетовый - База данных
- 🔴 Красный - Неоптимизированные/ошибки
