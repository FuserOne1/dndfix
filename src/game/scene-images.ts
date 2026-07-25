import type { Character } from '../types';
import { AI_MODELS } from '../lib/ai-config';
import { supabase } from '../lib/supabase';
import type { ArtStyle, CampaignBible, CampaignPreferences, SceneImage, SceneImageLayout, StoryScene } from './types';
import { normalizeSceneType } from './scene-director';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_IMAGE_URL = 'https://openrouter.ai/api/v1/images';
export const SCENE_IMAGE_BUCKET = 'scene-images';

const STYLE_PROMPTS: Record<ArtStyle, string> = {
  'dark-comic': 'dark European fantasy comic, expressive ink linework, restrained colors, dramatic chiaroscuro, mature graphic storytelling',
  'classic-fantasy': 'classic high fantasy book illustration, painterly detail, rich natural colors, cinematic light',
  'graphic-novel': 'modern graphic novel, bold silhouettes, textured inks, selective color, cinematic composition',
  watercolor: 'atmospheric fantasy watercolor, visible paper texture, delicate washes, poetic light',
  anime: 'serious cinematic fantasy anime, detailed backgrounds, expressive characters, sophisticated color grading',
};

export function sceneImageLayout(scene: StoryScene): SceneImageLayout {
  const type = normalizeSceneType(scene.type);
  return type === 'climax' || type === 'ending' || (type === 'discovery' && scene.tension === 5) ? 'comic-3' : 'wide';
}

export function shouldAutoIllustrate(scene: StoryScene, sceneNumber: number, preferences: CampaignPreferences, previousIllustratedScene?: number): boolean {
  const mode = preferences.illustrationMode || 'important';
  if (mode === 'off') return false;
  if (mode === 'all') return true;
  const type = normalizeSceneType(scene.type);
  if (sceneNumber === 1 || type === 'climax' || type === 'ending') return true;
  const important = type === 'discovery' || (type === 'personal' && (scene.tension || 0) >= 4) || (type === 'combat' && scene.tension === 5);
  if (!important) return false;
  return previousIllustratedScene === undefined || sceneNumber - previousIllustratedScene >= 3;
}

export async function loadSceneImage(campaignId: string, sceneId: string): Promise<SceneImage | null> {
  const { data, error } = await supabase.from('campaign_scene_images').select('*').eq('campaign_id', campaignId).eq('scene_id', sceneId).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : null;
}

export async function latestIllustratedScene(campaignId: string, beforeSceneNumber: number): Promise<number | undefined> {
  const { data } = await supabase.from('campaign_scene_images').select('scene_number').eq('campaign_id', campaignId).eq('status', 'ready').lt('scene_number', beforeSceneNumber).order('scene_number', { ascending: false }).limit(1).maybeSingle();
  return data?.scene_number;
}

interface GenerateSceneImageInput {
  campaignId: string;
  sceneNumber: number;
  scene: StoryScene;
  bible: CampaignBible;
  preferences: CampaignPreferences;
  characters: Character[];
  userId: string;
  currentVersion?: number;
  layout?: SceneImageLayout;
}

export async function generateAndSaveSceneImage(input: GenerateSceneImageInput): Promise<SceneImage> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('VITE_OPENROUTER_API_KEY не настроен');
  const version = (input.currentVersion || 0) + 1;
  const layout = input.layout || sceneImageLayout(input.scene);
  const pending = toRow({ campaignId: input.campaignId, sceneId: input.scene.id, sceneNumber: input.sceneNumber, status: 'pending', layout, version, model: AI_MODELS.IMAGE, createdBy: input.userId });
  const { error: pendingError } = await supabase.from('campaign_scene_images').upsert(pending, { onConflict: 'campaign_id,scene_id' });
  if (pendingError) throw new Error(`Не удалось создать запись иллюстрации: ${pendingError.message}`);

  let prompt = fallbackPrompt(input.scene, input.bible, input.preferences, input.characters, layout);
  try {
    prompt = await createPrompt(apiKey, input.scene, input.bible, input.preferences, input.characters, layout);
    const generated = await requestImage(apiKey, prompt);
    const extension = mimeExtension(generated.mediaType);
    const storagePath = `${safePath(input.campaignId)}/${safePath(input.scene.id)}/v${version}.${extension}`;
    const blob = base64ToBlob(generated.base64, generated.mediaType);
    const { error: uploadError } = await supabase.storage.from(SCENE_IMAGE_BUCKET).upload(storagePath, blob, { contentType: generated.mediaType, upsert: true });
    if (uploadError) throw new Error(`Не удалось сохранить изображение: ${uploadError.message}`);
    const { data: publicUrl } = supabase.storage.from(SCENE_IMAGE_BUCKET).getPublicUrl(storagePath);
    const ready: SceneImage = { campaignId: input.campaignId, sceneId: input.scene.id, sceneNumber: input.sceneNumber, status: 'ready', layout, prompt, imageUrl: publicUrl.publicUrl, storagePath, model: AI_MODELS.IMAGE, version, createdBy: input.userId };
    const { data, error } = await supabase.from('campaign_scene_images').update(toRow(ready)).eq('campaign_id', input.campaignId).eq('scene_id', input.scene.id).select('*').single();
    if (error) throw error;
    return fromRow(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка генерации';
    await supabase.from('campaign_scene_images').update({ status: 'failed', prompt, error: message, updated_at: new Date().toISOString() }).eq('campaign_id', input.campaignId).eq('scene_id', input.scene.id);
    throw new Error(message);
  }
}

async function createPrompt(apiKey: string, scene: StoryScene, bible: CampaignBible, preferences: CampaignPreferences, characters: Character[], layout: SceneImageLayout): Promise<string> {
  const characterAnchors = characters.map(character => ({ name: character.name, ancestry: character.race, class: character.class, background: character.background, equipment: character.equipment }));
  const relevantNpcs = bible.keyNpcs.filter(npc => scene.body.join(' ').includes(npc.name)).map(npc => ({ name: npc.name, role: npc.role, motive: npc.motive }));
  const request = `Create one production-ready English image prompt for this RPG scene. Preserve names, ancestries, equipment and mood. Do not invent modern objects. No lettering, speech bubbles, captions, logos or UI. ${layout === 'comic-3' ? 'Compose a single coherent page with exactly three clearly separated cinematic panels: establishing beat, decisive action/revelation, emotional aftermath.' : 'Compose one wide cinematic chapter illustration with a clear focal point.'}\n\nART DIRECTION: ${STYLE_PROMPTS[preferences.artStyle || 'dark-comic']}\nCAMPAIGN: ${bible.title}; ${bible.setting}; ${bible.centralConflict}\nSCENE: ${scene.title}, ${scene.location}\nPROSE: ${scene.body.join('\n')}\nHEROES: ${JSON.stringify(characterAnchors)}\nRELEVANT NPCS: ${JSON.stringify(relevantNpcs)}\nReturn only the final prompt, no markdown.`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(OPENROUTER_CHAT_URL, { method: 'POST', signal: controller.signal, headers: headers(apiKey), body: JSON.stringify({ model: AI_MODELS.WORKHORSE, temperature: 0.4, max_tokens: 500, messages: [{ role: 'user', content: request }] }) });
    if (!response.ok) throw new Error(`Gemini не собрала промпт: ${response.status}`);
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('Gemini вернула пустой промпт');
    return content.trim();
  } finally { window.clearTimeout(timeout); }
}

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

function sanitizeForSafety(prompt: string): string {
  return prompt
    .replace(/\bdark\b/gi, 'moody')
    .replace(/\bchiaroscuro\b/gi, 'dramatic lighting')
    .replace(/\bviolence\b/gi, 'tension')
    .replace(/\bviolent\b/gi, 'intense')
    .replace(/\bblood\b/gi, 'red dust')
    .replace(/\b血腥\b/gi, 'red mist')
    .replace(/\bkill\b/gi, 'defeat')
    .replace(/\bdeath\b/gi, 'danger')
    .replace(/\bdead\b/gi, 'fallen')
    .replace(/\bcorpse\b/gi, 'remains')
    .replace(/\bgore\b/gi, 'dust')
    .replace(/\bbrutal\b/gi, 'fierce')
    .replace(/\bslash\b/gi, 'strike')
    .replace(/\bstab\b/gi, 'thrust')
    .replace(/\bsevered\b/gi, 'broken')
    .replace(/\bmaim\b/gi, 'wound')
    .replace(/\bmutilat\b/gi, 'injure')
    .replace(/\bhorror\b/gi, 'dread')
    .replace(/\bnightmare\b/gi, 'shadow')
    .replace(/\bdemon\b/gi, 'fiend')
    .replace(/\bdevil\b/gi, 'fiend')
    .replace(/\bhell\b/gi, 'abyss')
    .replace(/\bskull\b/gi, 'symbol')
    .replace(/\bskeleton\b/gi, 'ancient figure')
    .replace(/\bzombie\b/gi, 'undead creature')
    .replace(/\bundead\b/gi, 'spectral figure')
    .replace(/\bweapon\b/gi, 'tool')
    .replace(/\bsword\b/gi, 'blade')
    .replace(/\baxe\b/gi, 'cleaver')
    .replace(/\bchain\b/gi, 'rope');
}

async function requestImage(apiKey: string, prompt: string): Promise<{ base64: string; mediaType: string }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90_000);
  try {
    const body: Record<string, unknown> = { model: AI_MODELS.IMAGE, prompt, n: 1, aspect_ratio: '16:9', safety_settings: SAFETY_SETTINGS };
    let response = await fetch(OPENROUTER_IMAGE_URL, { method: 'POST', signal: controller.signal, headers: headers(apiKey), body: JSON.stringify(body) });
    if (!response.ok) {
      const detail = await response.text();
      const isSafety = /IMAGE_SAFETY/i.test(detail);
      if (isSafety) {
        console.warn('Gemini IMAGE_SAFETY triggered, retrying with sanitized prompt');
        const safePrompt = sanitizeForSafety(prompt);
        controller.abort();
        const controller2 = new AbortController();
        const timeout2 = window.setTimeout(() => controller2.abort(), 90_000);
        try {
          response = await fetch(OPENROUTER_IMAGE_URL, { method: 'POST', signal: controller2.signal, headers: headers(apiKey), body: JSON.stringify({ ...body, prompt: safePrompt }) });
        } finally { window.clearTimeout(timeout2); }
        if (!response.ok) {
          const detail2 = await response.text();
          throw new Error(`Nano Banana не смогла нарисовать сцену (${response.status}): ${detail2.slice(0, 240)}`);
        }
      } else {
        throw new Error(`Nano Banana не смогла нарисовать сцену (${response.status}): ${detail.slice(0, 240)}`);
      }
    }
    const payload = await response.json();
    const image = payload.data?.[0];
    if (!image?.b64_json) throw new Error('Модель не вернула изображение');
    return { base64: image.b64_json, mediaType: image.media_type || 'image/png' };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Генерация картинки заняла больше 90 секунд');
    throw error;
  } finally { window.clearTimeout(timeout); }
}

function fallbackPrompt(scene: StoryScene, bible: CampaignBible, preferences: CampaignPreferences, characters: Character[], layout: SceneImageLayout): string {
  const heroes = characters.map(character => `${character.name}, ${character.race} ${character.class}, carrying ${character.equipment.join(', ')}`).join('; ');
  const composition = layout === 'comic-3' ? 'exactly three separate cinematic comic panels showing setup, decisive beat, aftermath' : 'one wide cinematic chapter illustration';
  return `${STYLE_PROMPTS[preferences.artStyle || 'dark-comic']}, ${composition}. ${bible.setting}. Scene: ${scene.title} at ${scene.location}. ${scene.body.join(' ')} Heroes: ${heroes}. Consistent character design, readable action, no text, no captions, no speech bubbles, no logo.`;
}

function headers(apiKey: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': window.location.origin, 'X-Title': 'Chronicles RPG' };
}

function base64ToBlob(base64: string, mediaType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mediaType });
}

function mimeExtension(mediaType: string) { return mediaType.includes('webp') ? 'webp' : mediaType.includes('jpeg') ? 'jpg' : 'png'; }
function safePath(value: string) { return value.replace(/[^a-zA-Z0-9_-]/g, '_'); }

function toRow(image: SceneImage) {
  return { campaign_id: image.campaignId, scene_id: image.sceneId, scene_number: image.sceneNumber, status: image.status, layout: image.layout, prompt: image.prompt || null, image_url: image.imageUrl || null, storage_path: image.storagePath || null, model: image.model || null, error: image.error || null, version: image.version, created_by: image.createdBy || null, updated_at: new Date().toISOString() };
}

function fromRow(row: any): SceneImage {
  return { id: row.id, campaignId: row.campaign_id, sceneId: row.scene_id, sceneNumber: row.scene_number, status: row.status, layout: row.layout, prompt: row.prompt || undefined, imageUrl: row.image_url || undefined, storagePath: row.storage_path || undefined, model: row.model || undefined, error: row.error || undefined, version: row.version || 1, createdBy: row.created_by || undefined, createdAt: row.created_at, updatedAt: row.updated_at };
}
