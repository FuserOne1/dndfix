import { normalizeSceneType } from './scene-director';
import type { StoryScene } from './types';

export type ScenePalette = 'ember' | 'mystic' | 'forest' | 'frost' | 'royal' | 'rest' | 'void';
export type SceneWeather = 'none' | 'mist' | 'rain' | 'snow' | 'embers' | 'dust' | 'stars';

export interface ScenePresentation {
  palette: ScenePalette;
  weather: SceneWeather;
  tension: 1 | 2 | 3 | 4 | 5;
  label: string;
  glyph: string;
}

const TYPE_PRESENTATION: Record<string, Pick<ScenePresentation, 'palette' | 'label' | 'glyph'>> = {
  narrative: { palette: 'royal', label: 'Повествование', glyph: '❦' },
  social: { palette: 'royal', label: 'Разговор', glyph: '◇' },
  exploration: { palette: 'forest', label: 'Исследование', glyph: '⌖' },
  investigation: { palette: 'mystic', label: 'Расследование', glyph: '◉' },
  challenge: { palette: 'ember', label: 'Испытание', glyph: '◆' },
  combat: { palette: 'ember', label: 'Столкновение', glyph: '⚔' },
  travel: { palette: 'forest', label: 'Путь', glyph: '➶' },
  camp: { palette: 'rest', label: 'Привал', glyph: '♨' },
  rest: { palette: 'rest', label: 'Отдых', glyph: '☽' },
  trade: { palette: 'royal', label: 'Торговля', glyph: '¤' },
  loot: { palette: 'royal', label: 'Находка', glyph: '✦' },
  personal: { palette: 'mystic', label: 'Личная сцена', glyph: '❖' },
  discovery: { palette: 'mystic', label: 'Открытие', glyph: '✧' },
  climax: { palette: 'void', label: 'Кульминация', glyph: '✺' },
  ending: { palette: 'frost', label: 'Финал', glyph: '☼' },
};

export function getScenePresentation(scene: StoryScene): ScenePresentation {
  const type = normalizeSceneType(scene.type);
  const base = TYPE_PRESENTATION[type] || TYPE_PRESENTATION.narrative;
  const text = `${scene.location} ${scene.title} ${scene.body.join(' ')}`.toLocaleLowerCase('ru');
  let palette = base.palette;
  let weather: SceneWeather = 'none';

  if (/снег|снеж|метел|л[её]д|мороз|север|зим/.test(text)) { palette = 'frost'; weather = 'snow'; }
  else if (/дожд|ливень|гроза|шторм/.test(text)) weather = 'rain';
  else if (/туман|дымк|болот|испарен/.test(text)) weather = 'mist';
  else if (/пожар|плам|угол|пепел|лава|горящ/.test(text)) { palette = 'ember'; weather = 'embers'; }
  else if (/пустын|пыль|песок|руин/.test(text)) weather = 'dust';
  else if (/ноч|зв[её]зд|космос|астрал/.test(text)) weather = 'stars';
  else if (type === 'combat' || type === 'climax') weather = 'embers';
  else if (type === 'investigation' || type === 'discovery') weather = 'mist';

  return { ...base, palette, weather, tension: scene.tension || 1 };
}

export function choiceGlyph(choice: { intent?: string; requirements?: { items?: string[] }; consequences: { startsBattle?: boolean } }): string {
  const intent = (choice.intent || '').toLocaleLowerCase('ru');
  if (choice.requirements?.items?.length) return '◆';
  if (choice.consequences.startsBattle || /атак|удар|бой|оруж/.test(intent)) return '⚔';
  if (/говор|убеж|обман|спрос|договор/.test(intent)) return '◇';
  if (/искать|осмотр|изуч|след|расслед/.test(intent)) return '◉';
  if (/уйти|бежать|путь|идти|обойти/.test(intent)) return '➶';
  return '❯';
}
