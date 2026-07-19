import { Character } from '../types';
import { AI_MODELS } from '../lib/ai-config';
import { CampaignBible, CampaignPreferences, CampaignState, ChoiceResolution, SceneBlueprint, StoryScene } from './types';
import { equippedItemNames, normalizeInventory } from './inventory';
import { applyBlueprint, chooseNextBlueprint, ensureScenePlan, normalizeSceneType, servicesForScene } from './scene-director';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function requestJson<T>(system: string, prompt: string): Promise<T> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('VITE_OPENROUTER_API_KEY не настроен');
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Chronicles RPG',
    },
    body: JSON.stringify({
      model: AI_MODELS.MAIN,
      temperature: 0.65,
      max_tokens: 7000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Генератор кампании недоступен: ${response.status}`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Генератор вернул пустой ответ');
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || content;
  return JSON.parse(fenced) as T;
}

function characterContext(character: Character) {
  const inventory = normalizeInventory(character);
  return {
    name: character.name,
    lineage: character.race,
    class: character.class,
    origin: character.background,
    attributes: {
      strength: character.strength,
      dexterity: character.dexterity,
      constitution: character.constitution,
      intelligence: character.intelligence,
      wisdom: character.wisdom,
      charisma: character.charisma,
    },
    backstory: character.backstory_data || character.story_summary || '',
    tags: character.rules_data?.storyTags || [],
    gold: character.gold || 0,
    equipped: equippedItemNames(inventory),
    inventory: inventory.items.map(item => ({ name: item.name, quantity: item.quantity })),
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
  "endings":[{"id":"ending-1","title":"...","condition":"..."}],
  "characterHooks":[{"characterName":"точное имя героя","hook":"личный конфликт","relatedNpc":"опционально"}]
}

Количество актов: короткая 3, средняя 4, длинная 5. Для каждого героя обязательно создай личный крючок. Тайны должны иметь заранее определённые ответы.`;
  try {
    return ensureScenePlan(validateBible(await requestJson<CampaignBible>(system, prompt)), preferences, characters);
  } catch (error) {
    console.warn('Campaign generation failed, using local campaign:', error);
    return ensureScenePlan(createFallbackBible(preferences, characters), preferences, characters);
  }
}

export async function generateOpeningScene(bible: CampaignBible, preferences: CampaignPreferences, characters: Character[]): Promise<StoryScene> {
  const system = sceneSystemPrompt();
  const blueprint = bible.scenePlan?.[0];
  const prompt = `Напиши первую сцену кампании. Она должна сразу поставить героев перед конкретной проблемой, но не начинать обязательный бой.

БИБЛИЯ:
${JSON.stringify(bible, null, 2)}

ГЕРОИ:
${JSON.stringify(characters.map(characterContext), null, 2)}

НАСТРОЙКИ:
${JSON.stringify(preferences, null, 2)}

Верни StoryScene в заданном формате. Дай 3–5 содержательных вариантов: прямой, осторожный, социальный и хотя бы один условный под конкретного героя.`;
  try {
    return validateScene(await requestJson<StoryScene>(system, `${prompt}\n\nSCENE CONTRACT (do not change its fields):\n${JSON.stringify(blueprint, null, 2)}`), bible.acts[0]?.id || 'act-1', 'scene-1', blueprint);
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
  const prompt = `Продолжи кампанию строго в рамках библии. Учитывай фактический результат выбора, не переигрывай его и не добавляй новых глобальных тайн без необходимости.

БИБЛИЯ:
${JSON.stringify(input.bible, null, 2)}

ПРЕДЫДУЩАЯ СЦЕНА:
${JSON.stringify(input.previousScene, null, 2)}

РЕЗУЛЬТАТ:
${JSON.stringify(input.resolution, null, 2)}

СОСТОЯНИЕ:
${JSON.stringify(input.state, null, 2)}

ГЕРОИ:
${JSON.stringify(input.characters.map(characterContext), null, 2)}

Верни следующую StoryScene. id должен быть "${nextId}".`;
  try {
    return validateScene(await requestJson<StoryScene>(sceneSystemPrompt(), `${prompt}\n\nSCENE CONTRACT (do not change its fields):\n${JSON.stringify(blueprint, null, 2)}`), input.state.currentActId, nextId, blueprint);
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
   "check":{"attribute":"strength|dexterity|constitution|intelligence|wisdom|charisma","difficulty":12},
   "requirements":{"classIds":[],"lineageIds":[],"items":[],"flags":[],"minAttribute":{}},
   "consequences":{"successFlags":[],"failureFlags":[],"removeItems":[],"grantItems":[],"hpChange":0,"startsBattle":false,"battle":{"enemies":[],"rewards":{"xp":0,"items":[]},"description":"только если начинается бой"}}
 }]
}
Пиши выразительно, но компактно: 2–5 абзацев. Если передан SCENE CONTRACT, дословно соблюдай его type, audience, purpose, tension, services, actId и focusCharacter: ты отвечаешь только за прозу и варианты. Последствия в JSON являются предложением движку, а не уже свершившимся фактом. Не добавляй свободный ввод.`;
}

function validateBible(value: CampaignBible): CampaignBible {
  if (!value?.title || !value?.premise || !Array.isArray(value.acts) || value.acts.length < 2) throw new Error('Некорректная библия кампании');
  return value;
}

function validateScene(value: StoryScene, fallbackActId: string, fallbackId: string, blueprint?: SceneBlueprint): StoryScene {
  if (!value || !Array.isArray(value.body) || value.body.length === 0 || !Array.isArray(value.choices)) throw new Error('Некорректная сцена');
  const type = normalizeSceneType(value.type);
  const validated: StoryScene = {
    ...value,
    id: value.id || fallbackId,
    actId: value.actId || fallbackActId,
    title: value.title || 'Безымянная сцена',
    location: value.location || 'Неизвестное место',
    type,
    audience: value.audience || (type === 'personal' ? 'personal' : 'group'),
    services: value.services || servicesForScene(type),
    choices: value.choices.slice(0, 6).map((choice, index) => ({
      ...choice,
      id: choice.id || `choice-${index + 1}`,
      label: choice.label || `Вариант ${index + 1}`,
      intent: choice.intent || choice.label,
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
