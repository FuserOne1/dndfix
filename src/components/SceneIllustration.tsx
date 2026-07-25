import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, Loader2, RefreshCw, WandSparkles, X } from 'lucide-react';
import type { Character } from '../types';
import { supabase } from '../lib/supabase';
import type { CampaignBible, CampaignPreferences, SceneImage, StoryScene } from '../game/types';
import { generateAndSaveSceneImage, latestIllustratedScene, loadSceneImage, shouldAutoIllustrate } from '../game/scene-images';

// Survives React StrictMode remounts so one scene cannot start two paid requests.
const automaticGenerationClaims = new Set<string>();

interface SceneIllustrationProps {
  campaignId: string;
  scene: StoryScene;
  sceneNumber: number;
  bible?: CampaignBible;
  preferences?: CampaignPreferences;
  characters?: Character[];
  currentUserId?: string;
  canGenerate?: boolean;
  autoGenerate?: boolean;
  compact?: boolean;
}

export default function SceneIllustration({ campaignId, scene, sceneNumber, bible, preferences, characters = [], currentUserId = '', canGenerate = false, autoGenerate = false, compact = false }: SceneIllustrationProps) {
  const [sceneImage, setSceneImage] = useState<SceneImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const attemptedAuto = useRef('');

  const load = useCallback(async () => {
    try {
      const image = await loadSceneImage(campaignId, scene.id);
      setSceneImage(image);
      const stalePending = image?.status === 'pending' && isStale(image.updatedAt);
      setGenerating(image?.status === 'pending' && !stalePending);
      setError(image?.status === 'failed' ? image.error || 'Изображение не создалось' : stalePending ? 'Предыдущая генерация прервалась. Можно запустить её снова.' : '');
      return image;
    } catch (caught) {
      if (canGenerate) setError(databaseHint(caught));
      return null;
    } finally { setLoading(false); }
  }, [campaignId, canGenerate, scene.id]);

  const generate = useCallback(async () => {
    if (!canGenerate || !bible || !preferences || !currentUserId || generating) return;
    setGenerating(true); setError('');
    try {
      const image = await generateAndSaveSceneImage({ campaignId, sceneNumber, scene, bible, preferences, characters, userId: currentUserId, currentVersion: sceneImage?.version });
      setSceneImage(image);
    } catch (caught) {
      setError(databaseHint(caught));
      await load();
    } finally { setGenerating(false); }
  }, [bible, campaignId, canGenerate, characters, currentUserId, generating, load, preferences, scene, sceneImage?.version, sceneNumber]);

  useEffect(() => {
    setSceneImage(null); setLoading(true); setGenerating(false); setError('');
    void load();
    const channel = supabase.channel(`scene-image:${campaignId}:${scene.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_scene_images', filter: `campaign_id=eq.${campaignId}` }, () => void load()).subscribe();
    const poll = window.setInterval(() => void load(), 5_000);
    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [campaignId, load, scene.id]);

  useEffect(() => {
    const key = `${campaignId}:${scene.id}`;
    if (!autoGenerate || !canGenerate || loading || sceneImage || error || attemptedAuto.current === key || automaticGenerationClaims.has(key) || !preferences) return;
    attemptedAuto.current = key;
    void latestIllustratedScene(campaignId, sceneNumber).then(previous => {
      if (!shouldAutoIllustrate(scene, sceneNumber, preferences, previous) || automaticGenerationClaims.has(key)) return;
      automaticGenerationClaims.add(key);
      void generate().finally(() => automaticGenerationClaims.delete(key));
    });
  }, [autoGenerate, campaignId, canGenerate, error, generate, loading, preferences, scene, scene.id, sceneImage, sceneNumber]);

  if (loading && compact) return null;
  if (sceneImage?.status === 'ready' && sceneImage.imageUrl) return <>
    <figure className={`${compact ? 'my-6' : 'mt-6'} group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl`}>
      <button onClick={() => setFullscreen(true)} className="block w-full cursor-zoom-in" aria-label="Открыть иллюстрацию целиком"><img src={sceneImage.imageUrl} alt={`Иллюстрация сцены «${scene.title}»`} className="w-full aspect-video object-cover"/></button>
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-12 pointer-events-none"><span className="text-[10px] uppercase tracking-[0.18em] text-zinc-300">{sceneImage.layout === 'comic-3' ? 'Три кадра · ключевая сцена' : 'Иллюстрация сцены'}</span>{canGenerate && <button onClick={() => void generate()} className="pointer-events-auto p-2 rounded-lg bg-black/60 text-zinc-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition" aria-label="Перерисовать"><RefreshCw className="w-4 h-4"/></button>}</figcaption>
    </figure>
    {fullscreen && <div className="fixed inset-0 z-[120] bg-black/95 p-3 sm:p-8 flex items-center justify-center" onClick={() => setFullscreen(false)}><button className="absolute right-4 top-4 p-3 rounded-full bg-zinc-900 text-white" aria-label="Закрыть"><X/></button><img onClick={event => event.stopPropagation()} src={sceneImage.imageUrl} alt={`Иллюстрация сцены «${scene.title}»`} className="max-h-full max-w-full object-contain rounded-xl"/></div>}
  </>;

  if (compact) return null;
  if (generating || (sceneImage?.status === 'pending' && !isStale(sceneImage.updatedAt))) return <div className="mt-6 aspect-video rounded-2xl border border-zinc-800 bg-zinc-900/70 flex flex-col items-center justify-center text-center p-6 overflow-hidden relative"><div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-violet-500/5 animate-pulse"/><Loader2 className="w-7 h-7 animate-spin text-amber-400 relative"/><strong className="mt-3 text-sm relative">Nano Banana рисует сцену…</strong><span className="text-xs text-zinc-600 mt-1 relative">Можно читать дальше — картинка появится сама</span></div>;
  if (!canGenerate) return null;
  return <div className="mt-6 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-hidden min-w-0"><div className="flex gap-3 min-w-0"><ImageIcon className="w-5 h-5 text-zinc-600 shrink-0"/><div className="min-w-0"><strong className="text-sm">Эта сцена пока без иллюстрации</strong>{error && <p className="text-xs text-amber-400 mt-1 break-words">{error}</p>}</div></div><button disabled={generating || error.includes('миграц')} onClick={() => void generate()} className="px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm font-bold flex items-center justify-center gap-2 shrink-0 disabled:opacity-40"><WandSparkles className="w-4 h-4"/>{sceneImage?.status === 'failed' ? 'Попробовать ещё раз' : 'Нарисовать сцену'}</button></div>;
}

function databaseHint(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /campaign_scene_images|scene-images|schema cache|relation|bucket/i.test(message) ? `Нужна свежая migration_interactive_rpg_v1.sql. ${message}` : message;
}

function isStale(updatedAt?: string): boolean {
  return Boolean(updatedAt && Date.now() - new Date(updatedAt).getTime() > 3 * 60_000);
}
