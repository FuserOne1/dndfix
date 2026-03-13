/**
 * Утилиты для тестирования AI Orchestrator
 */

import { AIOrchestrator } from './ai-orchestrator';
import { Message, CharacterStats } from '../types';
import { compareOptimization } from './ai-config';

/**
 * Создает тестовые сообщения для проверки суммаризации
 */
export function createTestMessages(count: number): Message[] {
  const messages: Message[] = [];
  const scenarios = [
    'Я иду в таверну и заказываю эль.',
    'Осматриваю комнату в поисках подозрительных личностей.',
    'Подхожу к бармену и спрашиваю о местных слухах.',
    'Бросаю кубик на проверку восприятия.',
    'Пытаюсь убедить стражника пропустить меня.',
    'Атакую гоблина своим мечом!',
    'Использую заклинание огненного шара.',
    'Проверяю свой инвентарь.',
    'Отдыхаю у костра и восстанавливаю HP.',
    'Исследую древние руины.',
  ];
  
  for (let i = 0; i < count; i++) {
    const isAI = i % 2 === 1;
    messages.push({
      id: `test-${i}`,
      room_id: 'test-room',
      sender_id: isAI ? 'ai' : 'user',
      sender_name: isAI ? 'Dungeon Master' : 'Test Player',
      content: isAI 
        ? `Ты ${scenarios[i % scenarios.length]} Что делаешь дальше?`
        : scenarios[i % scenarios.length],
      created_at: new Date(Date.now() - (count - i) * 60000).toISOString(),
      is_ai: isAI,
    });
  }
  
  return messages;
}

/**
 * Создает тестовые характеристики персонажа
 */
export function createTestCharacterStats(): Record<string, CharacterStats> {
  return {
    'Test Player': {
      name: 'Test Player',
      race: 'Human',
      class: 'Fighter',
      level: 3,
      hp: { current: 25, max: 30 },
      xp: 900,
      stats: {
        strength: 16,
        dexterity: 14,
        constitution: 15,
        intelligence: 10,
        wisdom: 12,
        charisma: 8,
      },
      background: 'Soldier',
      equipment: ['Longsword', 'Shield', 'Chain Mail', 'Healing Potion'],
      story_summary: 'Начал путешествие в деревне, встретил гоблинов, спас торговца.',
    },
  };
}

/**
 * Тест суммаризации
 */
export async function testSummarization(openRouterApiKey: string) {
  console.log('🧪 Testing Summarization...\n');

  const messages = createTestMessages(20);

  console.log(`Created ${messages.length} test messages`);
  console.log('First message:', messages[0].content);
  console.log('Last message:', messages[messages.length - 1].content);
  console.log('\n---\n');

  try {
    const { summarizeHistory } = await import('./ai-orchestrator');
    const summary = await summarizeHistory(messages, openRouterApiKey);

    console.log('✅ Summarization successful!\n');
    console.log('Summary:', summary.summary);
    console.log('Key NPCs:', summary.keyNPCs);
    console.log('Current Quests:', summary.currentQuests);
    console.log('Inventory:', summary.inventory);
    console.log('Key Events:', summary.keyEvents);
  } catch (error: any) {
    console.error('❌ Summarization failed:', error.message);
  }
}

/**
 * Тест генерации промпта для картинки
 */
export async function testImagePrompt(openRouterApiKey: string) {
  console.log('🧪 Testing Image Prompt Generation...\n');

  const messages = createTestMessages(5);
  const characterStats = createTestCharacterStats();

  try {
    const { generateImagePrompt } = await import('./ai-orchestrator');
    const prompt = await generateImagePrompt(messages, characterStats, openRouterApiKey);

    console.log('✅ Image prompt generated!\n');
    console.log('Prompt:', prompt);
  } catch (error: any) {
    console.error('❌ Image prompt generation failed:', error.message);
  }
}

/**
 * Тест полного цикла генерации
 */
export async function testFullGeneration(
  openRouterApiKey: string,
) {
  console.log('🧪 Testing Full AI Generation...\n');

  const orchestrator = new AIOrchestrator({
    mainModel: 'anthropic/claude-sonnet-4.6',
    summaryModel: 'google/gemini-2.5-flash',
    openRouterApiKey,
  });

  const messages = createTestMessages(20);
  const characterStats = createTestCharacterStats();
  const systemPrompt = 'You are a Dungeon Master for a D&D game.';

  console.log(`Testing with ${messages.length} messages...`);

  try {
    const response = await orchestrator.processMessage(
      systemPrompt,
      messages,
      characterStats
    );

    console.log('✅ Generation successful!\n');
    console.log('Response length:', response.length, 'characters');
    console.log('First 200 chars:', response.slice(0, 200));
  } catch (error: any) {
    console.error('❌ Generation failed:', error.message);
  }
}

/**
 * Показывает сравнение стоимости
 */
export function showCostComparison() {
  console.log('💰 Cost Comparison\n');
  console.log('='.repeat(60));
  
  const scenarios = [
    { messages: 10, label: 'Short conversation' },
    { messages: 30, label: 'Medium conversation' },
    { messages: 50, label: 'Long conversation' },
    { messages: 100, label: 'Very long conversation' },
  ];
  
  for (const scenario of scenarios) {
    const cost = compareOptimization(scenario.messages);
    
    console.log(`\n${scenario.label} (${scenario.messages} messages):`);
    console.log(`  Without optimization: $${cost.withoutOptimization.toFixed(4)}`);
    console.log(`  With optimization:    $${cost.withOptimization.toFixed(4)}`);
    console.log(`  Savings:              $${cost.savings.toFixed(4)} (${cost.savingsPercent.toFixed(1)}%)`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\nOn 1000 requests with 50 messages each:');
  const longConv = compareOptimization(50);
  console.log(`  Without optimization: $${(longConv.withoutOptimization * 1000).toFixed(2)}`);
  console.log(`  With optimization:    $${(longConv.withOptimization * 1000).toFixed(2)}`);
  console.log(`  Total savings:        $${(longConv.savings * 1000).toFixed(2)}`);
}

/**
 * Запуск всех тестов
 */
export async function runAllTests(
  openRouterApiKey: string
) {
  console.log('🚀 Running All Tests\n');
  console.log('='.repeat(60));

  // 1. Cost comparison
  showCostComparison();

  console.log('\n\n');

  // 2. Summarization test
  await testSummarization(openRouterApiKey);

  console.log('\n\n');

  // 3. Image prompt test
  await testImagePrompt(openRouterApiKey);

  console.log('\n\n');

  // 4. Full generation test
  await testFullGeneration(openRouterApiKey);

  console.log('\n\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
}

/**
 * Пример использования в консоли браузера:
 *
 * import { runAllTests } from './lib/ai-test';
 *
 * runAllTests(
 *   'sk-or-v1-xxxxx' // OpenRouter key
 * );
 */
