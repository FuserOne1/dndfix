import { Character } from '../types';
import { AI_MODELS } from '../lib/ai-config';
import { CampaignBible, CampaignPreferences, CampaignState, ChoiceResolution, SceneBlueprint, StoryScene } from './types';
import { equippedItemNames, normalizeInventory } from './inventory';
import { applyBlueprint, chooseNextBlueprint, ensureScenePlan, normalizeSceneType, servicesForScene } from './scene-director';
import { normalizeChoiceCheck } from './rules';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface AiRequestOptions {
  model?: string;
  timeoutMs?: number;
  temperature?: number;
}

async function requestJson<T>(system: string, prompt: string, options: AiRequestOptions = {}): Promise<T> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('VITE_OPENROUTER_API_KEY не настроен');
  const content = await requestCompletion(apiKey, system, prompt, {
    model: options.model || AI_MODELS.MAIN,
    timeoutMs: options.timeoutMs || 50_000,
    temperature: options.temperature ?? 0.72,
  });
  try {
    return parseJson<T>(content);
  } catch (parseError) {
    if ((options.model || AI_MODELS.MAIN) === AI_MODELS.WORKHORSE) throw parseError;
    console.warn('Claude returned malformed JSON, asking Gemini to repair it:', parseError);
    const repaired = await requestCompletion(
      apiKey,
      'Ты технический JSON-редактор. Исправь только синтаксис и структуру JSON, не переписывай художественный текст и не добавляй новые факты. Ответ — только корректный JSON.',
      `Исправь JSON:\n${content}`,
      { model: AI_MODELS.WORKHORSE, timeoutMs: 25_000, temperature: 0.2 },
    );
    return parseJson<T>(repaired);
  }
}

async function requestCompletion(apiKey: string, system: string, prompt: string, options: Required<AiRequestOptions>): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs);
  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Chronicles RPG',
    },
    body: JSON.stringify({
      model: options.model,
      temperature: options.temperature,
      max_tokens: 16000,
      response_format: { type: 'json_object' },
      plugins: [{ id: 'response-healing' }],
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error(`Генерация превысила ${Math.round(options.timeoutMs / 1000)} секунд`);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  if (!response.ok) {
    const details = await response.text();
    let providerMessage = '';
    try { providerMessage = JSON.parse(details)?.error?.message || ''; } catch { providerMessage = details; }
    throw new Error(`OpenRouter вернул ${response.status}${providerMessage ? `: ${providerMessage.slice(0, 300)}` : ''}`);
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Генератор вернул пустой ответ');
  return content;
}

function parseJson<T>(content: string): T {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || content;
  return JSON.parse(fenced) as T;
}

function truncate(text: string, max: number): string { return text.length > max ? text.slice(0, max) + '…' : text; }

function characterContext(character: Character, includeInventory = false) {
  const inventory = normalizeInventory(character);
  const bd = character.backstory_data;
  const backstory = bd ? [bd.goal, bd.fear, bd.secret, ...bd.hooks].filter(Boolean).map(s => truncate(s, 200)).join(' · ') : character.story_summary || '';
  const ctx: Record<string, unknown> = {
    name: character.name,
    lineage: character.race,
    class: character.class,
    origin: character.background,
    hp: `${character.hp_current}/${character.hp_max}`,
    attributes: {
      strength: character.strength,
      dexterity: character.dexterity,
      constitution: character.constitution,
      intelligence: character.intelligence,
      wisdom: character.wisdom,
      charisma: character.charisma,
    },
    backstory,
    tags: character.rules_data?.storyTags || [],
    gold: character.gold || 0,
    equipped: equippedItemNames(inventory),
  };
  if (includeInventory) ctx.inventory = inventory.items.map(item => item.name);
  return ctx;
}

export interface GeneratedCampaignPackage {
  bible: CampaignBible;
  opening: StoryScene;
}

export async function generateCampaignPackage(preferences: CampaignPreferences, characters: Character[]): Promise<GeneratedCampaignPackage> {
  const variation = createCampaignVariation();
  const system = `Ты — главный автор интерактивной текстовой RPG для оригинальной d20-системы. За один ответ создай библию всей кампании и полностью написанную первую сцену. История должна иметь заранее определённые тайны, личные линии героев, кульминацию и несколько возможных финалов. Завязка, свободное пожелание игрока и предыстории героев — обязательные авторские обещания, а не необязательное вдохновение. Не меняй факты и характеристики героев, не используй коммерческие франшизы. Ответ — только JSON вида {"bible":CampaignBible,"opening":StoryScene}.`;
  const prompt = `НАСТРОЙКИ:\n${JSON.stringify(preferences)}

ГЕРОИ:\n${JSON.stringify(characters.map(characterContext))}

ТВОРЧЕСКИЙ КЛЮЧ ЭТОЙ ГЕНЕРАЦИИ:
${JSON.stringify(variation)}

Используй ключ как обязательное направление для новой истории. Даже при одинаковых настройках и героях результат должен отличаться местом действия, центральной угрозой, антагонистом, тайной и первой проблемой. Не начинай у безлюдных городских ворот, с брошенной телеги, сухого колодца или таинственного колокола, если этого прямо не просил игрок.

ТРЕБОВАНИЯ К БИБЛИИ:
- поля: title, tagline, premise, setting, tone, centralConflict, antagonist, keyNpcs, acts, truths, endings, characterHooks;
- актов: короткая кампания — 3, средняя — 4, длинная — 5;
- каждый акт: id, title, goal, turningPoint, sceneSeeds;
- создай 4–6 действительно разных концовок; у каждой стабильный id, выразительное title и проверяемое condition через решения, флаги, отношения, судьбы NPC или состояние мира;
- для каждого героя отдельный characterHook с точным именем;
- characterHook обязан исходить из цели, страха, тайны или сюжетных крючков предыстории, а не быть случайной новой биографией;
- premise и customWish должны непосредственно влиять на центральный конфликт, акты или финал;
- все тайны имеют заранее определённые ответы.

ТРЕБОВАНИЯ К ПЕРВОЙ СЦЕНЕ:
- id "scene-1", actId первого акта, type "narrative";
- конкретная проблема с первых абзацев, без обязательного боя;
- 5–8 выразительных абзацев по 2–4 предложения и 3–5 содержательных вариантов;
- сцена должна показать, чего хочет хотя бы один герой, почему он не может просто уйти и как проблема касается его лично;
- поля StoryScene: id, actId, title, location, body, type, recap, choices;
- каждый выбор: id, label, description, intent, необязательные check/requirements и consequences;
- в consequences.world добавляй только логичные системные результаты выбора: изменение отношений с NPC, состояние героя, открытие локации, этап задания или улику; числовые изменения отношений от -10 до 10 и всегда с причиной;
- хотя бы один вариант должен учитывать конкретного героя.

Не включай scenePlan: технический план построит игровой движок.`;

  try {
    const rulesPrompt = `${prompt}\n\nRULES FOR CHECKS AND PROSE:\n- A check must include attribute, a fitting skill, and base difficulty from 10 to 15.\n- Allowed Russian skill names: Атлетика, Акробатика, Скрытность, Ловкость рук, Знание, Расследование, Природа, Медицина, Проницательность, Внимание, Выживание, Убеждение, Обман, Запугивание, Выступление.\n- Body paragraphs may moderately use **bold**, *italic*, > quotes and --- scene dividers. Do not use headings, tables or lists inside prose.`;
    const generated = await requestJson<{ bible: CampaignBible; opening: StoryScene }>(system, rulesPrompt, { model: AI_MODELS.MAIN, timeoutMs: 105_000, temperature: 0.88 });
    const bible = ensureScenePlan(ensurePlayerPromises(validateBible(generated.bible), preferences, characters), preferences, characters);
    const opening = validateScene(generated.opening, bible.acts[0]?.id || 'act-1', 'scene-1', bible.scenePlan?.[0]);
    return { bible, opening };
  } catch (error) {
    console.error('Campaign package generation failed:', error);
    const reason = error instanceof Error ? error.message : 'неизвестная ошибка';
    throw new Error(`Claude не создал кампанию, поэтому игра не будет подменять её одинаковой демо-историей. ${reason}`);
  }
}

export function createCampaignVariation() {
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    openingShape: pick(['публичное событие с внезапным нарушением порядка', 'личная встреча, которая оказывается ловушкой', 'прибытие во время необъяснимого природного явления', 'сделка с немедленной неприятной ценой', 'обнаружение невозможного предмета', 'праздник, ритуал или суд, сорванный открытием']),
    conflictEngine: pick(['борьба за право владеть опасной правдой', 'распадающийся союз бывших врагов', 'цена спасения места, обречённого чужим решением', 'охота, в которой роли охотника и жертвы меняются', 'наследие, меняющее память живых', 'власть, исполняющая обещания слишком буквально']),
    sensoryMotif: pick(['пепел и медь', 'стекло и холодный свет', 'цветущие растения и ржавчина', 'ветер и натянутые канаты', 'чернила и белый камень', 'тёплый дождь и звериные маски']),
  };
}

export function compactBibleForScene(bible: CampaignBible) {
  const { scenePlan: _scenePlan, ...creativeBible } = bible;
  return creativeBible;
}

function ensurePlayerPromises(bible: CampaignBible, preferences: CampaignPreferences, characters: Character[]): CampaignBible {
  const generated = bible.playerPromises || [];
  const required: NonNullable<CampaignBible['playerPromises']> = [];
  if (preferences.premise.trim()) required.push({ id: 'promise-premise', source: 'premise', text: preferences.premise.trim() });
  if (preferences.customWish.trim()) required.push({ id: 'promise-wish', source: 'wish', text: preferences.customWish.trim() });
  if (preferences.themes.trim()) required.push({ id: 'promise-themes', source: 'theme', text: preferences.themes.trim() });
  for (const character of characters) {
    const backstory = character.backstory_data;
    const parts = [backstory?.goal, backstory?.fear, backstory?.secret, ...(backstory?.hooks || [])].filter(Boolean) as string[];
    const hook = bible.characterHooks.find(item => item.characterName === character.name)?.hook;
    const text = [...new Set([hook, ...parts].filter(Boolean) as string[])].join(' · ');
    if (text) required.push({ id: `promise-character-${character.id || character.name}`, source: 'character', characterName: character.name, text });
  }
  const merged = [...required, ...generated.filter(item => !required.some(requiredItem => requiredItem.id === item.id))];
  return { ...bible, playerPromises: merged };
}

function compactStateForScene(state: CampaignState) {
  return {
    flags: state.flags,
    inventory: state.inventory,
    relationships: state.relationships,
    currentActId: state.currentActId,
    sceneNumber: state.sceneNumber,
    recentSceneIds: state.completedSceneIds.slice(-6),
    recentTypes: state.director?.recentTypes,
    personalSceneCounts: state.director?.personalSceneCounts,
    systems: state.systems ? {
      relationships: state.systems.relationships,
      conditions: state.systems.conditions,
      locations: state.systems.locations,
      routes: state.systems.routes,
      quests: state.systems.quests,
      clues: state.systems.clues,
    } : undefined,
  };
}

function compactPreviousScene(scene: StoryScene) {
  return {
    id: scene.id, actId: scene.actId, title: scene.title, location: scene.location, body: scene.body,
    type: scene.type, focusCharacter: scene.focusCharacter, recap: scene.recap,
    choices: scene.choices.map(choice => ({ id: choice.id, label: choice.label, intent: choice.intent })),
  };
}

export async function generateCampaignBible(preferences: CampaignPreferences, characters: Character[]): Promise<CampaignBible> {
  const system = `Ты — архитектор интерактивных RPG-кампаний для собственной d20-системы. Создай связный заранее определённый каркас, а не импровизационный чат. Не меняй характеристики героев. Не используй существующие миры, персонажей и названия коммерческих франшиз. Ответ — только JSON.`;
  const prompt = `Создай библию кампании по настройкам.

НАСТРОЙКИ:
${JSON.stringify(preferences, null, 2)}

ГЕРОИ:
${JSON.stringify(characters.map(characterContext), null, 2)}

Верни объект CampaignBible:
{
  "title":"...","tagline":"...","premise":"...","setting":"...","tone":["..."],
  "centralConflict":"...",
  "antagonist":{"name":"...","role":"...","motive":"..."},
  "keyNpcs":[{"id":"npc-1","name":"...","role":"...","motive":"...","secret":"..."}],
  "acts":[{"id":"act-1","title":"...","goal":"...","turningPoint":"...","sceneSeeds":["..."]}],
  "truths":["неизменный факт мира"],
  "endings":[{"id":"ending-1","title":"...","condition":"проверяемое условие через решения, отношения, флаги или судьбу NPC"}],
  "characterHooks":[{"characterName":"точное имя героя","hook":"личный конфликт","relatedNpc":"опционально"}]
}

Количество актов: короткая 3, средняя 4, длинная 5. Создай 4–6 разных концовок со стабильными id и конкретными условиями. Для каждого героя обязательно создай личный крючок. Тайны должны иметь заранее определённые ответы.`;
  try {
    return ensureScenePlan(ensurePlayerPromises(validateBible(await requestJson<CampaignBible>(system, prompt, { model: AI_MODELS.MAIN, timeoutMs: 60_000 })), preferences, characters), preferences, characters);
  } catch (error) {
    console.warn('Campaign generation failed, using local campaign:', error);
    return ensureScenePlan(ensurePlayerPromises(createFallbackBible(preferences, characters), preferences, characters), preferences, characters);
  }
}

export async function generateOpeningScene(bible: CampaignBible, preferences: CampaignPreferences, characters: Character[]): Promise<StoryScene> {
  const system = sceneSystemPrompt();
  const blueprint = bible.scenePlan?.[0];
  const prompt = `Напиши первую сцену кампании. Она должна сразу поставить героев перед конкретной проблемой, но не начинать обязательный бой.

БИБЛИЯ:
${JSON.stringify(compactBibleForScene(bible))}

ГЕРОИ:
${JSON.stringify(characters.map(c => characterContext(c, true)), null, 2)}

НАСТРОЙКИ:
${JSON.stringify(preferences, null, 2)}

Верни StoryScene в заданном формате. Напиши 5–8 абзацев по 2–4 предложения: покажи мотивацию героев и связь проблемы с их прошлым. Дай 3–5 содержательных вариантов: прямой, осторожный, социальный и хотя бы один условный под конкретного героя.`;
  try {
    return validateScene(await requestJson<StoryScene>(system, `${prompt}\n\nITEM-AWARE CHOICES: inspect the heroes' inventory. When an owned item can reasonably solve or alter the scene, include an additional choice requiring it. requirements.items must contain the exact item name from the inventory; removeItems only for a genuinely consumed or lost item.\n\nSCENE CONTRACT (do not change its fields):\n${JSON.stringify(blueprint)}`, { model: AI_MODELS.MAIN, timeoutMs: 50_000 }), bible.acts[0]?.id || 'act-1', 'scene-1', blueprint);
  } catch (error) {
    console.warn('Opening scene generation failed, using local scene:', error);
    return createFallbackOpening(bible, characters, blueprint);
  }
}

export async function generateNextScene(input: {
  bible: CampaignBible;
  previousScene: StoryScene;
  resolution: ChoiceResolution;
  state: CampaignState;
  characters: Character[];
  preferences: CampaignPreferences;
}): Promise<StoryScene> {
  const nextId = `scene-${input.state.sceneNumber}`;
  const blueprint = chooseNextBlueprint(input);
  const storyBible = ensurePlayerPromises(input.bible, input.preferences, input.characters);
  const prompt = `Продолжи кампанию строго в рамках библии. Учитывай фактический результат выбора, не переигрывай его и не добавляй новых глобальных тайн без необходимости.

БИБЛИЯ:
${JSON.stringify(compactBibleForScene(storyBible))}

ПРЕДЫДУЩАЯ СЦЕНА:
${JSON.stringify(compactPreviousScene(input.previousScene))}

РЕЗУЛЬТАТ:
${JSON.stringify(input.resolution, null, 2)}

СОСТОЯНИЕ:
${JSON.stringify(compactStateForScene(input.state))}

ГЕРОИ:
${JSON.stringify(input.characters.map(c => characterContext(c, true)), null, 2)}

ОБЯЗАТЕЛЬСТВА ПЕРЕД ИГРОКАМИ:
${JSON.stringify(storyBible.playerPromises || [])}

Верни следующую StoryScene. id должен быть "${nextId}". Не перескакивай через последствия: сцена должна развить выбранный момент как небольшую главу, ясно показать мотивацию действующих героев и закончиться новой осмысленной развилкой. Если у героя hp "0/X", он тяжело ранен: напиши сцену спасения, отлёживания, помощи путника, находки зелья или иного сюжетного способа выжить. Не называй это «привалом» — это критическое состояние, требующее немедленного внимания. Смерть персонажа — только как финальная концовка кампании, не как блокировка.`;
  try {
    return validateScene(await requestJson<StoryScene>(sceneSystemPrompt(), `${prompt}\n\nRULES: checks use a fitting Russian skill from the allowed list and a base DC from 10 to 15. Campaign difficulty is ${input.preferences.difficulty}; the engine applies its modifier. Body paragraphs may use **bold**, *italic*, > quotes and --- scene dividers when artistically useful. Inspect every hero inventory: whenever an owned item can reasonably solve, simplify, or alter the scene, include an item-aware choice. Copy its exact inventory name into requirements.items. Put it in removeItems only when the action truly consumes or loses it. Never grant an item only in prose: every obtained item must also be listed in grantItems. If SCENE CONTRACT has type "ending", choose the single ending from BIBLE whose condition best matches the actual state and prior decisions, copy its title EXACTLY into StoryScene.title, resolve the consequences in full prose and return choices: []. Do not invent an extra ending.\n\nSCENE CONTRACT (do not change its fields):\n${JSON.stringify(blueprint)}`, { model: AI_MODELS.MAIN, timeoutMs: 50_000 }), input.state.currentActId, nextId, blueprint);
  } catch (error) {
    console.warn('Next scene generation failed, using local continuation:', error);
    return createFallbackContinuation(input, nextId, blueprint);
  }
}

function sceneSystemPrompt() {
  return `Ты пишешь сцены интерактивной текстовой RPG по уже утверждённой библии. Ты не ведущий чата и не принимаешь решения за игроков. Ответ — только JSON StoryScene:
{
 "id":"scene-N","actId":"act-1","title":"...","location":"...","body":["абзац 1","абзац 2"],
 "type":"narrative|social|exploration|investigation|challenge|combat|travel|camp|rest|trade|loot|personal|discovery|climax|ending",
 "audience":"group|personal|solo","purpose":"цель сцены","tension":1,"services":{"trade":false,"rest":false,"stash":false},"focusCharacter":"опционально","recap":"одно предложение",
 "choices":[{
   "id":"choice-1","label":"короткое действие","description":"ожидаемый подход","intent":"что герой пытается сделать",
   "check":{"attribute":"strength|dexterity|constitution|intelligence|wisdom|charisma","skill":"Атлетика|Акробатика|Скрытность|Ловкость рук|Знание|Расследование|Природа|Медицина|Проницательность|Внимание|Выживание|Убеждение|Обман|Запугивание|Выступление","difficulty":12},
   "requirements":{"classIds":[],"lineageIds":[],"items":[],"flags":[],"minAttribute":{}},
   "consequences":{"successFlags":[],"failureFlags":[],"removeItems":[],"grantItems":[],"hpChange":0,"successGold":0,"failureGold":0,"startsBattle":false,"battle":{"enemies":[],"rewards":{"xp":0,"items":[]},"description":"только если начинается бой"},"world":{"relationships":[{"targetKey":"id существующего NPC или фракции","targetName":"имя","targetType":"npc|faction","trust":0,"respect":0,"fear":0,"affection":0,"reason":"конкретная причина"}],"conditions":[{"action":"add|remove","characterId":"id героя","key":"стабильный-id","name":"название","description":"эффект","severity":"minor|major|critical","durationScenes":2}],"locations":[{"key":"стабильный-id","name":"название","description":"что известно","status":"rumored|discovered|visited|blocked","danger":1,"services":{"trade":false,"rest":false,"stash":false}}],"routes":[{"fromKey":"id","toKey":"id","label":"маршрут","danger":1,"status":"open|blocked|unknown"}],"quests":[{"key":"id","title":"название","description":"цель","status":"active|completed|failed","stage":"текущий этап"}],"clues":[{"key":"id","title":"название","description":"факт","reliability":"uncertain|likely|confirmed"}]}}
 }]
}
Пиши как главу интерактивного романа: 5–8 абзацев по 2–4 предложения, с атмосферой, действиями, понятными желаниями героев и связью с предыдущим решением. Не пересказывай сцену сухой сводкой и не перескакивай сразу к следующей локации. Если передан SCENE CONTRACT, дословно соблюдай его type, audience, purpose, tension, services, actId и focusCharacter: ты отвечаешь только за прозу и варианты. В trade-сцене обязательно введи торговца в тексте и прямо сообщи, что у него можно купить и продать вещи. В loot-сцене дай хотя бы один способ получить золото или полезный предмет. Денежные награды обычной сцены держи в пределах 3–18 золотых. Поле consequences.world описывает только проверяемые изменения систем игры: отношения, состояния, карту, задания и улики. Используй существующие стабильные key из СОСТОЯНИЯ; новый key создавай только для действительно новой сущности. Изменения отношений держи в диапазоне -10..10 за обычный выбор и всегда указывай конкретную reason. Не дублируй уже известные улики и локации. Последствия являются предложением движку, а не уже свершившимся фактом. Не добавляй свободный ввод.`;
}

function validateBible(value: CampaignBible): CampaignBible {
  if (!value?.title || !value?.premise || !Array.isArray(value.acts) || value.acts.length < 2) throw new Error('Некорректная библия кампании');
  if (!Array.isArray(value.endings) || value.endings.length < 3) throw new Error('Кампания должна содержать минимум три разные концовки');
  return value;
}

function validateScene(value: StoryScene, fallbackActId: string, fallbackId: string, blueprint?: SceneBlueprint): StoryScene {
  if (!value) throw new Error('Некорректная сцена');
  const rawBody = typeof value.body === 'string' ? [value.body] : Array.isArray(value.body) ? value.body : [];
  const body = rawBody.length > 0 ? rawBody : ['Сцена без описания.'];
  const choices = Array.isArray(value.choices) ? value.choices : [];
  if (!Array.isArray(value.body) || !Array.isArray(value.choices)) console.warn('Scene normalized: body or choices were not arrays', { bodyType: typeof value.body, choicesType: typeof value.choices });
  const type = normalizeSceneType(value.type);
  const validated: StoryScene = {
    ...value,
    id: value.id || fallbackId,
    actId: value.actId || fallbackActId,
    title: value.title || 'Безымянная сцена',
    location: value.location || 'Неизвестное место',
    body,
    type,
    audience: value.audience || (type === 'personal' ? 'personal' : 'group'),
    services: value.services || servicesForScene(type),
    choices: choices.slice(0, 6).map((choice, index) => ({
      ...choice,
      id: choice.id || `choice-${index + 1}`,
      label: choice.label || `Вариант ${index + 1}`,
      intent: choice.intent || choice.label,
      check: choice.check ? normalizeChoiceCheck(choice.check, `${choice.label || ''} ${choice.description || ''} ${choice.intent || ''}`) : undefined,
      consequences: choice.consequences || {},
    })),
  };
  return enforceSceneMechanics(blueprint ? applyBlueprint(validated, blueprint) : validated);
}

function enforceSceneMechanics(scene: StoryScene): StoryScene {
  if (normalizeSceneType(scene.type) !== 'combat') return scene;
  return {
    ...scene,
    choices: scene.choices.map(choice => ({
      ...choice,
      consequences: { ...choice.consequences, startsBattle: true },
    })),
  };
}

function createFallbackBible(preferences: CampaignPreferences, characters: Character[]): CampaignBible {
  const place = preferences.setting || 'пограничное княжество, где старые дороги исчезают по ночам';
  return {
    title: 'Колокол под чёрной водой',
    tagline: 'Некоторые долги помнит сама земля.',
    premise: preferences.premise || `Герои прибывают в ${place} накануне события, которое местные предпочитают не называть.`,
    setting: place,
    tone: preferences.tones,
    centralConflict: 'Затопленный храм начинает возвращать миру то, что было принесено ему в жертву.',
    antagonist: { name: 'Регент Варн', role: 'хранитель старого договора', motive: 'Сохранить город, повторив преступление предков' },
    keyNpcs: [
      { id: 'mara', name: 'Мара Вей', role: 'картограф исчезающих улиц', motive: 'Найти брата', secret: 'Она слышит подземный колокол во сне' },
      { id: 'tollan', name: 'Толлан', role: 'старый лодочник', motive: 'Искупить участие в прошлом ритуале', secret: 'Знает безопасный путь к храму' },
    ],
    acts: [
      { id: 'act-1', title: 'Город без отражений', goal: 'Узнать причину первых исчезновений', turningPoint: 'Герои находят улицу, которой нет на картах', sceneSeeds: ['Закрытые ворота', 'Пропавший дозор', 'Карта Мары'] },
      { id: 'act-2', title: 'Дорога под водой', goal: 'Добраться до затопленного храма', turningPoint: 'Открывается истинная цена старого договора', sceneSeeds: ['Лодочник', 'Подземная пристань', 'Безмолвные паломники'] },
      { id: 'act-3', title: 'Последний удар колокола', goal: 'Разорвать или переписать договор', turningPoint: 'Регент предлагает героям занять его место', sceneSeeds: ['Зал имён', 'Выбор жертвы', 'Рассвет'] },
    ],
    truths: ['Колокол не создаёт мёртвых — он возвращает забытых.', 'Договор можно разрушить только добровольным отказом города от защиты.'],
    endings: [
      { id: 'free-city', title: 'Город без покровителя', condition: 'Раскрыть правду и разрушить договор' },
      { id: 'new-keepers', title: 'Новые хранители', condition: 'Переписать договор без жертвы' },
      { id: 'sunken', title: 'Под чёрной водой', condition: 'Не остановить последний удар' },
    ],
    characterHooks: characters.map(character => ({ characterName: character.name, hook: character.backstory_data?.goal || `Прошлое ${character.name} связано с одним из исчезнувших путников.` })),
  };
}

function createFallbackOpening(bible: CampaignBible, characters: Character[], blueprint?: SceneBlueprint): StoryScene {
  const specialist = characters.find(character => character.intelligence >= 14) || characters[0];
  const scene: StoryScene = {
    id: 'scene-1', actId: bible.acts[0]?.id || 'act-1', title: 'Ворота без стражи', location: bible.setting,
    body: [
      `К вечеру дорога выводит вас к городским воротам. Они распахнуты, хотя на стенах уже горят ночные огни. Ни стражи, ни торговцев — только брошенная телега перегораживает въезд.`,
      `Из караульной башни доносится мерный стук. На мокрой земле тянется цепочка босых следов, обрывающаяся у совершенно сухого колодца.`,
      `${specialist?.name || 'Один из героев'} замечает на телеге свежий знак: круг, перечёркнутый тремя волнистыми линиями. Такой же символ кто-то пытался соскоблить с городского герба.`,
    ],
    type: 'narrative', recap: 'Герои нашли открытые ворота и следы исчезнувшего дозора.',
    choices: [
      { id: 'tower', label: 'Подняться в караульную башню', description: 'Найти источник стука и осмотреть пост.', intent: 'исследовать башню', check: { attribute: 'wisdom', difficulty: 11 }, consequences: { successFlags: ['found-watch-log'], failureFlags: ['tower-noise'] } },
      { id: 'tracks', label: 'Идти по босым следам', description: 'Проверить колодец и землю вокруг него.', intent: 'исследовать следы', check: { attribute: 'wisdom', difficulty: 12 }, consequences: { successFlags: ['noticed-hidden-runes'], failureFlags: ['heard-the-bell'] } },
      { id: 'clear-road', label: 'Освободить проезд', description: 'Оттащить телегу и войти открыто.', intent: 'убрать телегу', check: { attribute: 'strength', difficulty: 10 }, consequences: { successFlags: ['helped-refugees'], failureFlags: ['injured-at-gate'], hpChange: -1 } },
      { id: 'read-mark', label: `Попросить ${specialist?.name || 'знатока'} изучить знак`, description: 'Определить происхождение символа.', intent: 'изучить символ', check: { attribute: 'intelligence', difficulty: 13 }, consequences: { successFlags: ['decoded-drowned-mark'] }, requirements: { minAttribute: { intelligence: 13 } } },
    ],
  };
  return enforceSceneMechanics(blueprint ? applyBlueprint(scene, blueprint) : { ...scene, audience: characters.length === 1 ? 'solo' : 'group', services: servicesForScene('narrative') });
}

function createFallbackContinuation(input: { previousScene: StoryScene; resolution: ChoiceResolution; state: CampaignState }, nextId: string, blueprint: SceneBlueprint): StoryScene {
  const successText = input.resolution.success ? 'Ваш замысел срабатывает, но открывает новую тревожную деталь.' : 'Замысел оборачивается осложнением, и времени на осторожность остаётся меньше.';
  return enforceSceneMechanics(applyBlueprint({
    id: nextId, actId: blueprint.actId, title: 'Знак на мостовой', location: input.previousScene.location,
    body: [successText, 'За ближайшим домом хлопает дверь. В переулке появляется девушка с покрытой чернилами картой. Она смотрит на вас так, словно ждала именно этого решения.', '«Если вы тоже слышали колокол, внутрь города лучше не входить по главной улице», — говорит она и показывает на узкий проход между домами.'],
    type: blueprint.type, recap: 'Незнакомая картограф предложила героям тайный путь.',
    choices: [
      { id: 'follow-mara', label: 'Пойти за картографом', description: 'Довериться незнакомке и избежать главной улицы.', intent: 'следовать за картографом', consequences: { successFlags: ['trusted-mara'] } },
      { id: 'question-mara', label: 'Сначала потребовать объяснений', description: 'Узнать, кто она и что происходит.', intent: 'допросить картографа', check: { attribute: 'charisma', difficulty: 11 }, consequences: { successFlags: ['mara-opened-up'], failureFlags: ['mara-distrust'] } },
      { id: 'main-street', label: 'Войти по главной улице', description: 'Не позволять незнакомке определять ваш путь.', intent: 'идти по главной улице', consequences: { successFlags: ['saw-empty-procession'] } },
    ],
  }, blueprint));
}
