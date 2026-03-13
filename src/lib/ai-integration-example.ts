/**
 * ПРИМЕР ИНТЕГРАЦИИ AI ORCHESTRATOR
 * 
 * Этот файл показывает, как использовать новую систему в Chat.tsx
 */

import { AIOrchestrator } from './ai-orchestrator';
import { Message, CharacterStats } from '../types';

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================

// Создаем оркестратор один раз при загрузке компонента
const orchestrator = new AIOrchestrator({
  // Основная модель (лучшая для RPG)
  mainModel: 'anthropic/claude-sonnet-4.6',

  // Модель для суммаризации (дешевая)
  summaryModel: 'google/gemini-2.5-flash',

  // Модель для генерации изображений
  imageModel: 'openai/gpt-5-image-mini',

  // API ключ (единый для всех моделей)
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',

  // Заголовки для OpenRouter (опционально)
  httpReferer: window.location.origin,
  xTitle: 'D&D Dark Fantasy RPG',
});

// ============================================================================
// ГЕНЕРАЦИЯ ОТВЕТА
// ============================================================================

async function generateAIResponse(
  systemPrompt: string,
  messages: Message[],
  characterStats: Record<string, CharacterStats>
): Promise<string> {
  try {
    // Оркестратор автоматически:
    // 1. Суммаризирует историю (если > 15 сообщений)
    // 2. Берет последние 10 сообщений
    // 3. Формирует оптимальный запрос
    // 4. Отправляет в Claude/GPT-4
    const response = await orchestrator.processMessage(
      systemPrompt,
      messages,
      characterStats
    );
    
    return response;
  } catch (error: any) {
    console.error('AI Response Error:', error);
    
    // Обработка ошибок
    if (error?.message?.includes('429')) {
      throw new Error('Rate limit exceeded. Please wait a moment.');
    } else if (error?.message?.includes('401') || error?.message?.includes('403')) {
      throw new Error('Invalid API key. Check your OpenRouter/Gemini keys.');
    } else if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
      throw new Error('Network error. Check your internet connection.');
    }
    
    throw new Error('AI service temporarily unavailable.');
  }
}

// ============================================================================
// ГЕНЕРАЦИЯ ПРОМПТА ДЛЯ КАРТИНКИ
// ============================================================================

async function generateImagePromptFromScene(
  messages: Message[],
  characterStats: Record<string, CharacterStats>
): Promise<string> {
  try {
    // Gemini Flash анализирует последние 5 сообщений и создает промпт
    const prompt = await orchestrator.generateImagePrompt(messages, characterStats);
    return prompt;
  } catch (error) {
    console.error('Image prompt generation error:', error);
    return 'fantasy scene, cinematic lighting, high quality';
  }
}

// ============================================================================
// ИНТЕГРАЦИЯ В CHAT.TSX
// ============================================================================

/**
 * Замени функцию triggerAIResponse в Chat.tsx на эту:
 */
export async function triggerAIResponseOptimized(
  systemPrompt: string,
  allMessages: Message[],
  characterStats: Record<string, CharacterStats>,
  onSuccess: (aiText: string) => void,
  onError: (errorMessage: string) => void
) {
  try {
    // Генерируем ответ через оркестратор
    const aiText = await generateAIResponse(
      systemPrompt,
      allMessages,
      characterStats
    );
    
    // Обрабатываем успешный ответ
    onSuccess(aiText);
  } catch (error: any) {
    // Обрабатываем ошибку
    onError(error.message || 'Unknown error');
  }
}

// ============================================================================
// ПРИМЕР ИСПОЛЬЗОВАНИЯ В КОМПОНЕНТЕ
// ============================================================================

/**
 * В Chat.tsx:
 *
 * 1. Импортируй оркестратор:
 *    import { AIOrchestrator } from '../lib/ai-orchestrator';
 *
 * 2. Создай экземпляр в компоненте:
 *    const orchestratorRef = useRef<AIOrchestrator | null>(null);
 *
 * 3. Инициализируй в useEffect:
 *    useEffect(() => {
 *      orchestratorRef.current = new AIOrchestrator({
 *        mainModel: 'anthropic/claude-sonnet-4.6',
 *        summaryModel: 'google/gemini-2.5-flash',
 *        imageModel: 'openai/gpt-5-image-mini',
 *        openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
 *      });
 *    }, []);
 *
 * 4. Замени вызов Groq на:
 *    const aiText = await orchestratorRef.current!.processMessage(
 *      SYSTEM_PROMPT,
 *      rpHistory,
 *      characterStats || {}
 *    );
 *
 * 5. Для генерации картинок:
 *    const imagePrompt = await orchestratorRef.current!.generateImagePrompt(
 *      messages,
 *      characterStats || {}
 *    );
 *    const imageResult = await orchestratorRef.current!.generateImage(imagePrompt);
 */

// ============================================================================
// МОНИТОРИНГ ЗАТРАТ
// ============================================================================

/**
 * Примерная стоимость на 1000 запросов:
 * 
 * БЕЗ ОПТИМИЗАЦИИ (весь контекст в Claude):
 * - Вход: 50 сообщений × 200 токенов = 10,000 токенов
 * - Выход: 500 токенов
 * - Claude 3.5 Sonnet: $3/M input, $15/M output
 * - Стоимость: (10k × $3/1M) + (500 × $15/1M) = $0.0375 за запрос
 * - На 1000 запросов: $37.50
 * 
 * С ОПТИМИЗАЦИЕЙ (суммаризация + последние 10):
 * - Gemini Flash суммаризация: 40 сообщений → 500 токенов сводки
 *   - Стоимость: ~$0.001
 * - Claude основной запрос: 500 (сводка) + 2000 (10 сообщений) = 2,500 токенов
 *   - Стоимость: (2.5k × $3/1M) + (500 × $15/1M) = $0.015
 * - Итого: $0.016 за запрос
 * - На 1000 запросов: $16.00
 * 
 * ЭКОНОМИЯ: ~57% ($21.50 на 1000 запросов)
 */

export { orchestrator, generateAIResponse, generateImagePromptFromScene };
