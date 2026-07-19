import { AI_MODELS } from '../lib/ai-config';
import { BackstoryData } from './types';

export interface BackstoryAnswers {
  homeland: string;
  goal: string;
  loss: string;
  connection: string;
  fear: string;
  secret: string;
  tone: 'concise' | 'dramatic' | 'dark';
}

export async function suggestBackstories(input: {
  name: string;
  lineage: string;
  className: string;
  origin: string;
  answers: BackstoryAnswers;
}): Promise<BackstoryData[]> {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!key) return localSuggestions(input);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${key}`,
        'HTTP-Referer': window.location.origin, 'X-Title': 'Chronicles Character Studio',
      },
      body: JSON.stringify({
        model: AI_MODELS.WORKHORSE,
        temperature: 0.75,
        max_tokens: 2600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Ты помогаешь создавать героев для оригинальной тёмно-фэнтезийной RPG. Не используй миры и имена коммерческих франшиз. Не меняй факты игрока. Ответ только JSON.' },
          { role: 'user', content: `Создай три разные предыстории для героя. Данные: ${JSON.stringify(input)}. Верни {"variants":[BackstoryData,BackstoryData,BackstoryData]}. Каждый BackstoryData: homeland, goal, loss, connection, fear, secret, values (2-3 строки), hooks (2-3 конкретных сюжетных крючка), prose (2-4 абзаца).` },
        ],
      }),
    });
    if (!response.ok) throw new Error(String(response.status));
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || content);
    if (!Array.isArray(parsed.variants) || parsed.variants.length === 0) throw new Error('empty variants');
    return parsed.variants.slice(0, 3).map((variant: Partial<BackstoryData>) => normalize(variant, input.answers));
  } catch (error) {
    console.warn('Backstory assistant failed, using local variants:', error);
    return localSuggestions(input);
  }
}

function normalize(value: Partial<BackstoryData>, answers: BackstoryAnswers): BackstoryData {
  return {
    homeland: value.homeland || answers.homeland,
    goal: value.goal || answers.goal,
    loss: value.loss || answers.loss,
    connection: value.connection || answers.connection,
    fear: value.fear || answers.fear,
    secret: value.secret || answers.secret,
    values: Array.isArray(value.values) ? value.values.slice(0, 4) : ['Верность собственному слову'],
    hooks: Array.isArray(value.hooks) ? value.hooks.slice(0, 4) : [answers.goal, answers.secret].filter(Boolean),
    prose: value.prose || '',
  };
}

function localSuggestions(input: { name: string; lineage: string; className: string; origin: string; answers: BackstoryAnswers }): BackstoryData[] {
  const { name, lineage, className, origin, answers } = input;
  const homeland = answers.homeland || 'поселение на дальней границе';
  const goal = answers.goal || 'узнать правду о событии из прошлого';
  const loss = answers.loss || 'дом, который уже невозможно вернуть';
  const connection = answers.connection || 'старый наставник, однажды спасший герою жизнь';
  const fear = answers.fear || 'снова оказаться бессильным перед чужой бедой';
  const secret = answers.secret || 'часть вины за давнюю трагедию лежит на самом герое';
  const base = { homeland, goal, loss, connection, fear, secret };
  return [
    { ...base, values: ['Верность важнее закона', 'За каждое обещание приходится платить'], hooks: [`След, связанный с целью: ${goal}`, `Возвращение человека: ${connection}`, `Кто-то узнал тайну: ${secret}`], prose: `${name} — ${lineage.toLowerCase()}, избравший путь «${className}». Детство прошло там, где ${homeland} определял жизнь каждого жителя. Всё изменилось после потери: ${loss}.\n\nС тех пор ${name} стремится ${goal}. Рядом с этой целью всегда стоит ${connection}, а за решимостью скрывается страх — ${fear}. Никому не известно, что ${secret}.` },
    { ...base, values: ['Правда опасна, но ложь опаснее', 'Нельзя требовать от других того, чего не сделаешь сам'], hooks: [`Свидетель события «${loss}» всё ещё жив`, `Цель героя ведёт к общему врагу`, `Происхождение «${origin}» даёт старого соперника`], prose: `До того как стать известным как ${className.toLowerCase()}, ${name} жил жизнью, которую определяли ${origin.toLowerCase()} и ${homeland}. После того как судьба отняла ${loss}, прежний путь закончился.\n\nТеперь у героя есть одна ясная цель: ${goal}. Помочь способен ${connection}, но встреча с ним может раскрыть правду: ${secret}. Больше всего ${name} боится ${fear}.` },
    { ...base, values: ['Свобода начинается с признания собственной вины', 'Чужая слабость не даёт права на жестокость'], hooks: [`Тайна героя известна неизвестному шантажисту`, `Потерянное может оказаться не уничтоженным`, `Страх станет буквальным испытанием`], prose: `${homeland} помнит ${name} не как героя. Там осталось слишком многое: ${loss}, незаконченный разговор и свидетель, которого следовало считать мёртвым.\n\nПуть «${className}» стал способом никогда больше не чувствовать ${fear}. Но настоящая причина путешествия — ${goal}. ${connection} связывает нынешнюю жизнь с прошлой, а тайна звучит хуже любой клятвы: ${secret}.` },
  ];
}
