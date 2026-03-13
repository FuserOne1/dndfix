/**
 * AI Orchestrator - Оптимизированная система запросов для RPG
 * 
 * Архитектура:
 * 1. Gemini 1.5 Flash - суммаризация истории + генерация промптов для картинок
 * 2. Claude/GPT-4/Gemini Pro - основная генерация ответов
 * 3. Кэширование сводок для экономии токенов
 */

import { Message, CharacterStats } from '../types';

// ============================================================================
// ТИПЫ
// ============================================================================

export interface AIConfig {
  // Основная модель для генерации ответов (по умолчанию: anthropic/claude-sonnet-4.6)
  mainModel: string;
  // Модель для суммаризации (по умолчанию: google/gemini-2.5-flash)
  summaryModel: string;
  // Модель для генерации изображений (по умолчанию: openai/gpt-5-image-mini)
  imageModel?: string;
  // OpenRouter API ключ (единый ключ для всех моделей)
  openRouterApiKey: string;
  // Заголовки для OpenRouter
  httpReferer?: string;
  xTitle?: string;
}

export interface ConversationContext {
  systemPrompt: string;
  globalSummary: string;  // Сводка всей истории
  recentHistory: Message[];  // Последние 10 сообщений
  characterStats: Record<string, CharacterStats>;
}

export interface SummarizationResult {
  summary: string;
  keyNPCs: string[];
  currentQuests: string[];
  inventory: string[];
  keyEvents: string[];
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RECENT_HISTORY_COUNT = 10;
const SUMMARIZE_THRESHOLD = 15; // Суммаризировать, если больше 15 сообщений

// ============================================================================
// УТИЛИТЫ
// ============================================================================

/**
 * Задержка с экспоненциальным backoff
 */
async function delay(ms: number, attempt: number = 0): Promise<void> {
  const backoff = ms * Math.pow(2, attempt);
  await new Promise(resolve => setTimeout(resolve, backoff));
}

/**
 * Retry wrapper для API запросов
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  onError?: (error: any, attempt: number) => void
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === retries - 1;
      
      // Проверяем, стоит ли повторять
      const shouldRetry = 
        error?.status === 429 || // Rate limit
        error?.status === 500 || // Server error
        error?.status === 502 || // Bad gateway
        error?.status === 503 || // Service unavailable
        error?.message?.includes('fetch') || // Network error
        error?.message?.includes('timeout');
      
      if (!shouldRetry || isLastAttempt) {
        throw error;
      }
      
      if (onError) {
        onError(error, attempt + 1);
      }
      
      await delay(RETRY_DELAY_MS, attempt);
    }
  }
  
  throw new Error('Max retries exceeded');
}

// ============================================================================
// СУММАРИЗАЦИЯ (Gemini 1.5 Flash)
// ============================================================================

/**
 * Суммаризирует историю сообщений в краткий лор-лист
 * Работает через OpenRouter с использованием рабочей модели (gemini-2.5-flash)
 */
export async function summarizeHistory(
  messages: Message[],
  openRouterApiKey: string,
  summaryModel: string = 'google/gemini-2.5-flash',
  previousSummary?: string
): Promise<SummarizationResult> {
  // Формируем текст истории
  const historyText = messages
    .filter(m => m.content && typeof m.content === 'string')
    .filter(m => m.sender_id !== 'gallery' && m.sender_id !== 'gallery-item')
    .map(m => `${m.sender_name}: ${m.content}`)
    .join('\n\n');

  const prompt = previousSummary
    ? `Обнови краткую сводку RPG-приключения, добавив новые события.

ПРЕДЫДУЩАЯ СВОДКА:
${previousSummary}

НОВЫЕ СОБЫТИЯ:
${historyText}

Верни JSON в формате:
{
  "summary": "Краткое описание всего путешествия (2-3 предложения)",
  "keyNPCs": ["Имя NPC 1", "Имя NPC 2"],
  "currentQuests": ["Квест 1", "Квест 2"],
  "inventory": ["Предмет 1", "Предмет 2"],
  "keyEvents": ["Событие 1", "Событие 2"]
}`
    : `Создай краткую сводку RPG-приключения из следующей истории:

${historyText}

Верни JSON в формате:
{
  "summary": "Краткое описание всего путешествия (2-3 предложения)",
  "keyNPCs": ["Имя NPC 1", "Имя NPC 2"],
  "currentQuests": ["Квест 1", "Квест 2"],
  "inventory": ["Предмет 1", "Предмет 2"],
  "keyEvents": ["Событие 1", "Событие 2"]
}`;

  const response = await withRetry(async () => {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'D&D RPG App',
      },
      body: JSON.stringify({
        model: summaryModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Низкая температура для точности
        max_tokens: 1024,
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenRouter API error: ${res.status} - ${errorText}`);
    }

    return res.json();
  });

  // Парсим ответ
  const text = response.choices?.[0]?.message?.content || '{}';

  // Извлекаем JSON из markdown блока, если есть
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

  try {
    const result = JSON.parse(jsonText);
    return {
      summary: result.summary || '',
      keyNPCs: result.keyNPCs || [],
      currentQuests: result.currentQuests || [],
      inventory: result.inventory || [],
      keyEvents: result.keyEvents || [],
    };
  } catch (e) {
    console.error('Failed to parse summarization result:', e);
    return {
      summary: text.slice(0, 500),
      keyNPCs: [],
      currentQuests: [],
      inventory: [],
      keyEvents: [],
    };
  }
}

// ============================================================================
// ГЕНЕРАЦИЯ ПРОМПТА ДЛЯ КАРТИНКИ (Workhorse модель)
// ============================================================================

/**
 * Генерирует промпт для Midjourney/DALL-E/GPT-5-Image из последних сообщений
 */
export async function generateImagePrompt(
  recentMessages: Message[],
  characterStats: Record<string, CharacterStats>,
  openRouterApiKey: string,
  workhorseModel: string = 'google/gemini-2.5-flash'
): Promise<string> {
  const historyText = recentMessages
    .filter(m => m.content && typeof m.content === 'string')
    .slice(-5) // Последние 5 сообщений
    .map(m => `${m.sender_name}: ${m.content}`)
    .join('\n\n');

  const statsText = Object.values(characterStats)
    .map(s => `${s.name} (${s.race} ${s.class})`)
    .join(', ');

  const prompt = `Создай детальный промпт для генерации изображения на основе RPG-сцены.

ПЕРСОНАЖИ: ${statsText}

ПОСЛЕДНИЕ СОБЫТИЯ:
${historyText}

Верни ТОЛЬКО промпт для Midjourney/DALL-E на английском языке (без объяснений).
Формат: "detailed fantasy scene, [описание], cinematic lighting, high quality, 4k"`;

  const response = await withRetry(async () => {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'D&D RPG App',
      },
      body: JSON.stringify({
        model: workhorseModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 256,
      })
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API error: ${res.status}`);
    }

    return res.json();
  });

  return response.choices?.[0]?.message?.content || 'fantasy scene';
}

// ============================================================================
// ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ (OpenRouter Image API)
// ============================================================================

export interface ImageGenerationResult {
  imageUrl?: string;
  error?: string;
}

/**
 * Генерирует изображение через OpenRouter (riverflow-v2-fast / DALL-E 3)
 */
export async function generateImage(
  prompt: string,
  openRouterApiKey: string,
  imageModel: string = 'sourceful/riverflow-v2-fast'
): Promise<ImageGenerationResult> {
  try {
    // riverflow-v2-fast использует chat completions API
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'D&D RPG App',
      },
      body: JSON.stringify({
        model: imageModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 16,
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { error: `Image generation failed: ${res.status} - ${errorText}` };
    }

    const response = await res.json();
    
    console.log('Image API Response:', JSON.stringify(response, null, 2));
    
    // riverflow-v2-fast: choices[0].message.images (массив изображений)
    const images = response.choices?.[0]?.message?.images;
    if (images && Array.isArray(images) && images.length > 0) {
      const imageUrl = images[0]?.image_url?.url || images[0]?.url;
      if (imageUrl) {
        return { imageUrl };
      }
    }
    
    // riverflow-v2-fast: choices[0].message.content (URL изображения)
    const content = response.choices?.[0]?.message?.content;
    if (content) {
      if (typeof content === 'string' && content.startsWith('http')) {
        return { imageUrl: content };
      }
      // Пробуем распарсить JSON
      try {
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        if (parsed.image_url?.url) {
          return { imageUrl: parsed.image_url.url };
        }
        if (parsed.url) {
          return { imageUrl: parsed.url };
        }
        if (parsed.image) {
          return { imageUrl: parsed.image };
        }
      } catch {}
    }
    
    // DALL-E формат: data[0].url
    if (response.data && response.data[0]?.url) {
      return { imageUrl: response.data[0].url };
    }
    
    return { error: 'No image URL in response. Response: ' + JSON.stringify(response).slice(0, 500) };
  } catch (error: any) {
    return { error: error.message || 'Failed to generate image' };
  }
}

// ============================================================================
// ОСНОВНАЯ ГЕНЕРАЦИЯ (OpenRouter)
// ============================================================================

/**
 * Формирует массив messages для OpenRouter API
 */
export function buildMessagesArray(context: ConversationContext): any[] {
  const messages: any[] = [];
  
  // 1. System Prompt (всегда первый)
  messages.push({
    role: 'system',
    content: context.systemPrompt
  });
  
  // 2. Global Summary (если есть)
  if (context.globalSummary) {
    messages.push({
      role: 'system',
      content: `ТЕКУЩИЙ КОНТЕКСТ:\n${context.globalSummary}\n\nХАРАКТЕРИСТИКИ ГЕРОЕВ: ${JSON.stringify(context.characterStats)}`
    });
  }
  
  // 3. Recent History (последние 10 сообщений)
  for (const msg of context.recentHistory) {
    messages.push({
      role: msg.is_ai ? 'assistant' : 'user',
      content: `${msg.sender_name}: ${msg.content}`
    });
  }
  
  return messages;
}

/**
 * Генерирует ответ через OpenRouter
 */
export async function generateResponse(
  config: AIConfig,
  context: ConversationContext
): Promise<string> {
  const messages = buildMessagesArray(context);

  console.log('🤖 Sending to OpenRouter:', {
    model: config.mainModel,
    messageCount: messages.length,
    hasGlobalSummary: !!context.globalSummary,
    recentHistoryCount: context.recentHistory.length,
  });

  const response = await withRetry(
    async () => {
      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openRouterApiKey}`,
          'HTTP-Referer': config.httpReferer || window.location.origin,
          'X-Title': config.xTitle || 'D&D RPG App',
        },
        body: JSON.stringify({
          model: config.mainModel,
          messages,
          temperature: 0.8,
          top_p: 0.9,
          max_tokens: 1024,
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenRouter API error: ${res.status} - ${errorText}`);
      }

      return res.json();
    },
    MAX_RETRIES,
    (error, attempt) => {
      console.warn(`OpenRouter request failed (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
    }
  );

  console.log('✅ Received response from OpenRouter');
  
  return response.choices?.[0]?.message?.content || '';
}

// ============================================================================
// ОРКЕСТРАТОР
// ============================================================================

export class AIOrchestrator {
  private config: AIConfig;
  private cachedSummary: SummarizationResult | null = null;
  private lastSummarizedCount: number = 0;

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * Обрабатывает новое сообщение и генерирует ответ
   */
  async processMessage(
    systemPrompt: string,
    allMessages: Message[],
    characterStats: Record<string, CharacterStats>
  ): Promise<string> {
    // Фильтруем служебные сообщения
    const rpMessages = allMessages.filter(
      m => m.sender_id !== 'gallery' &&
           m.sender_id !== 'gallery-item' &&
           !m.content?.startsWith('PAUSE:')
    );

    // Определяем, нужна ли суммаризация
    const needsSummarization =
      rpMessages.length > SUMMARIZE_THRESHOLD &&
      rpMessages.length > this.lastSummarizedCount + 5;

    let globalSummary = '';

    if (needsSummarization) {
      // Суммаризируем всю историю кроме последних 10
      const messagesToSummarize = rpMessages.slice(0, -RECENT_HISTORY_COUNT);

      if (messagesToSummarize.length > 0) {
        this.cachedSummary = await summarizeHistory(
          messagesToSummarize,
          this.config.openRouterApiKey,
          this.config.summaryModel,
          this.cachedSummary?.summary
        );

        this.lastSummarizedCount = rpMessages.length - RECENT_HISTORY_COUNT;
      }
    }

    // Формируем сводку
    if (this.cachedSummary) {
      globalSummary = `
СВОДКА ПРИКЛЮЧЕНИЯ: ${this.cachedSummary.summary}

КЛЮЧЕВЫЕ NPC: ${this.cachedSummary.keyNPCs.join(', ')}
ТЕКУЩИЕ КВЕСТЫ: ${this.cachedSummary.currentQuests.join(', ')}
ИНВЕНТАРЬ: ${this.cachedSummary.inventory.join(', ')}
ВАЖНЫЕ СОБЫТИЯ: ${this.cachedSummary.keyEvents.join('; ')}
`.trim();
    }

    // Берем последние сообщения
    const recentHistory = rpMessages.slice(-RECENT_HISTORY_COUNT);

    // Генерируем ответ
    const context: ConversationContext = {
      systemPrompt,
      globalSummary,
      recentHistory,
      characterStats,
    };

    return await generateResponse(this.config, context);
  }

  /**
   * Генерирует промпт для картинки
   */
  async generateImagePrompt(
    messages: Message[],
    characterStats: Record<string, CharacterStats>
  ): Promise<string> {
    return await generateImagePrompt(
      messages,
      characterStats,
      this.config.openRouterApiKey,
      this.config.summaryModel
    );
  }

  /**
   * Генерирует изображение
   */
  async generateImage(
    prompt: string
  ): Promise<ImageGenerationResult> {
    return await generateImage(
      prompt,
      this.config.openRouterApiKey,
      this.config.imageModel
    );
  }

  /**
   * Полная генерация изображения из сообщений
   */
  async generateImageFromMessages(
    messages: Message[],
    characterStats: Record<string, CharacterStats>
  ): Promise<ImageGenerationResult> {
    // Сначала генерируем промпт
    const prompt = await this.generateImagePrompt(messages, characterStats);
    
    // Затем генерируем изображение
    return await this.generateImage(prompt);
  }

  /**
   * Очищает кэш (например, при начале новой игры)
   */
  clearCache(): void {
    this.cachedSummary = null;
    this.lastSummarizedCount = 0;
  }
}
