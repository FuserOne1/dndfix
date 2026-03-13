/**
 * Конфигурация AI моделей
 * Все модели работают через OpenRouter для совместимости
 */

export const AI_MODELS = {
  // Основная модель (лучшая для RPG)
  MAIN: 'anthropic/claude-sonnet-4.6',
  
  // Рабочая лошадка (для суммаризации и простых задач)
  WORKHORSE: 'google/gemini-2.5-flash',
  
  // Модель для генерации изображений
  IMAGE: 'sourceful/riverflow-v2-fast',

  // Альтернативные модели (для переключения)
  ALTERNATIVES: {
    CLAUDE_35_SONNET: 'anthropic/claude-3.5-sonnet',
    GPT4: 'openai/gpt-4',
    GEMINI_PRO: 'google/gemini-pro-1.5',
  }
} as const;

export const AI_PRICING = {
  // Цены в $ за 1M токенов (примерные, уточнять на openrouter.ai)
  'anthropic/claude-sonnet-4.6': { input: 3, output: 15 },
  'google/gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'openai/gpt-5-image-mini': { input: 0, output: 0 }, // Цена за изображение
  'anthropic/claude-3.5-sonnet': { input: 3, output: 15 },
  'openai/gpt-4': { input: 30, output: 60 },
  'google/gemini-pro-1.5': { input: 1.25, output: 5 },
} as const;

export const DEFAULT_CONFIG = {
  // Рекомендуемая конфигурация для RPG
  mainModel: AI_MODELS.MAIN,
  summaryModel: AI_MODELS.WORKHORSE,
  imageModel: AI_MODELS.IMAGE,

  // Параметры генерации
  temperature: 0.8,  // Креативность (0.0 - 1.0)
  topP: 0.9,         // Разнообразие ответов
  maxTokens: 1024,   // Максимальная длина ответа

  // Параметры контекста
  summarizeThreshold: 15,  // Суммаризировать после N сообщений
  recentHistoryCount: 10,  // Сколько последних сообщений держать

  // Retry параметры
  maxRetries: 3,
  retryDelayMs: 1000,
} as const;

/**
 * Расчет примерной стоимости запроса
 */
export function estimateCost(
  model: keyof typeof AI_PRICING,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = AI_PRICING[model];
  if (!pricing) return 0;
  
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
}

/**
 * Примерный подсчет токенов (1 токен ≈ 4 символа)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Сравнение стоимости с оптимизацией и без
 */
export function compareOptimization(
  messageCount: number,
  avgMessageLength: number = 200
): {
  withoutOptimization: number;
  withOptimization: number;
  savings: number;
  savingsPercent: number;
} {
  const model = AI_MODELS.MAIN;
  const summaryModel = AI_MODELS.WORKHORSE;

  // Без оптимизации: все сообщения идут в основную модель
  const totalChars = messageCount * avgMessageLength;
  const totalTokens = estimateTokens(totalChars.toString());
  const outputTokens = 500;

  const withoutOptimization = estimateCost(model, totalTokens, outputTokens);

  // С оптимизацией: суммаризация + последние 10
  const recentMessages = Math.min(messageCount, 10);
  const oldMessages = Math.max(0, messageCount - 10);

  // Стоимость суммаризации
  const summaryInputTokens = estimateTokens((oldMessages * avgMessageLength).toString());
  const summaryOutputTokens = 500; // Сводка
  const summaryCost = estimateCost(summaryModel, summaryInputTokens, summaryOutputTokens);

  // Стоимость основного запроса
  const mainInputTokens = summaryOutputTokens + estimateTokens((recentMessages * avgMessageLength).toString());
  const mainCost = estimateCost(model, mainInputTokens, outputTokens);

  const withOptimization = summaryCost + mainCost;
  const savings = withoutOptimization - withOptimization;
  const savingsPercent = (savings / withoutOptimization) * 100;

  return {
    withoutOptimization,
    withOptimization,
    savings,
    savingsPercent,
  };
}

/**
 * Пример использования:
 * 
 * const cost = compareOptimization(50); // 50 сообщений
 * console.log(`Без оптимизации: $${cost.withoutOptimization.toFixed(4)}`);
 * console.log(`С оптимизацией: $${cost.withOptimization.toFixed(4)}`);
 * console.log(`Экономия: $${cost.savings.toFixed(4)} (${cost.savingsPercent.toFixed(1)}%)`);
 */
