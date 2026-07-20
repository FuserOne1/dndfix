import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ChoiceResolution, StoryScene } from '../game/types';
import SceneIllustration from './SceneIllustration';

export interface ArchiveSceneRow {
  scene_id: string;
  act_id: string;
  scene_number: number;
  content: StoryScene;
  resolution?: ChoiceResolution | null;
  created_at?: string;
}

interface SceneArchiveProps {
  campaignId: string;
  campaignTitle: string;
  acts: Array<{ id: string; title: string }>;
  currentScene: StoryScene;
  currentSceneNumber: number;
  onClose: () => void;
}

export function mergeArchiveScenes(rows: ArchiveSceneRow[], currentScene: StoryScene, currentSceneNumber: number): ArchiveSceneRow[] {
  const byNumber = new Map(rows.map(row => [row.scene_number, row]));
  if (!byNumber.has(currentSceneNumber)) {
    byNumber.set(currentSceneNumber, { scene_id: currentScene.id, act_id: currentScene.actId, scene_number: currentSceneNumber, content: currentScene });
  }
  return [...byNumber.values()].filter(row => row.content?.body?.length).sort((left, right) => left.scene_number - right.scene_number);
}

export default function SceneArchive({ campaignId, campaignTitle, acts, currentScene, currentSceneNumber, onClose }: SceneArchiveProps) {
  const [scenes, setScenes] = useState<ArchiveSceneRow[]>(() => mergeArchiveScenes([], currentScene, currentSceneNumber));
  const [selectedNumber, setSelectedNumber] = useState(Math.max(1, currentSceneNumber - 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error: loadError } = await supabase.from('campaign_scenes').select('scene_id, act_id, scene_number, content, resolution, created_at').eq('campaign_id', campaignId).order('scene_number');
      if (!active) return;
      const merged = mergeArchiveScenes((data || []) as ArchiveSceneRow[], currentScene, currentSceneNumber);
      setScenes(merged);
      const preferred = merged.find(row => row.scene_number === Math.max(1, currentSceneNumber - 1)) || merged.at(-1);
      if (preferred) setSelectedNumber(preferred.scene_number);
      if (loadError) setError('Не удалось загрузить старые сцены из базы. Текущая сцена доступна локально.');
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [campaignId, currentScene, currentSceneNumber]);

  const selectedIndex = Math.max(0, scenes.findIndex(row => row.scene_number === selectedNumber));
  const selected = scenes[selectedIndex] || scenes[0];
  const actTitle = acts.find(act => act.id === selected?.act_id)?.title;
  const choiceLabel = selected?.content.choices.find(choice => choice.id === selected.resolution?.choiceId)?.label;
  const progress = useMemo(() => scenes.length ? `${selectedIndex + 1} из ${scenes.length}` : '', [scenes.length, selectedIndex]);

  return <div className="fixed inset-0 z-[95] bg-[#09090b] text-zinc-100 overflow-hidden">
    <header className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center px-3 sm:px-5"><div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0"><button onClick={onClose} className="p-2.5 rounded-xl border border-zinc-800" aria-label="Закрыть хронику"><ArrowLeft className="w-4 h-4"/></button><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.2em] text-amber-500">Хроника кампании</p><h1 className="text-sm sm:text-base font-bold truncate">{campaignTitle}</h1></div></div><span className="text-xs text-zinc-500 shrink-0">{progress}</span></div></header>
    <div className="max-w-7xl mx-auto h-[calc(100vh-4rem)] grid lg:grid-cols-[280px_1fr]">
      <aside className="hidden lg:block border-r border-zinc-800 overflow-y-auto p-3 space-y-1">
        {scenes.map(row => <button key={row.scene_number} onClick={() => setSelectedNumber(row.scene_number)} className={`w-full text-left p-3 rounded-xl border ${row.scene_number === selected?.scene_number ? 'border-amber-500/40 bg-amber-500/10' : 'border-transparent hover:bg-zinc-900'}`}><span className="text-[10px] uppercase text-zinc-600">Сцена {row.scene_number}</span><strong className="block text-sm mt-1 line-clamp-2">{row.content.title}</strong>{row.resolution && <span className="block text-[10px] text-emerald-500 mt-1">решение принято</span>}</button>)}
      </aside>
      <main className="overflow-y-auto">
        <div className="lg:hidden sticky top-0 z-10 bg-zinc-950/95 border-b border-zinc-800 p-3"><select value={selected?.scene_number || ''} onChange={event => setSelectedNumber(Number(event.target.value))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm">{scenes.map(row => <option key={row.scene_number} value={row.scene_number}>Сцена {row.scene_number} · {row.content.title}</option>)}</select></div>
        {loading ? <div className="h-full flex items-center justify-center text-zinc-500"><Loader2 className="animate-spin mr-2"/>Загружаем хронику…</div> : selected ? <article className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-12">
          {error && <div className="mb-5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">{error}</div>}
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-600"><BookOpen className="w-3.5 h-3.5"/>Сцена {selected.scene_number}{actTitle ? ` · ${actTitle}` : ''}</div>
          <h2 className="text-3xl sm:text-5xl font-black mt-3">{selected.content.title}</h2>
          <p className="text-sm text-amber-500 mt-2">{selected.content.location}</p>
          <SceneIllustration compact campaignId={campaignId} scene={selected.content} sceneNumber={selected.scene_number}/>
          <div className="mt-8 space-y-6 text-[16px] sm:text-[18px] leading-8 text-zinc-300">{selected.content.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          {selected.resolution && <section className="mt-10 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/70"><p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Принятое решение</p>{choiceLabel && <strong className="block mt-2 text-amber-200">{choiceLabel}</strong>}<p className="text-sm text-zinc-400 mt-2">{selected.resolution.summary}</p>{selected.resolution.roll && <p className="text-xs text-zinc-600 mt-2">Бросок {selected.resolution.roll} · итог {selected.resolution.total} · сложность {selected.resolution.difficulty}</p>}</section>}
          <div className="mt-10 flex justify-between gap-3"><button disabled={selectedIndex <= 0} onClick={() => setSelectedNumber(scenes[selectedIndex - 1].scene_number)} className="px-4 py-3 rounded-xl border border-zinc-800 flex items-center gap-2 disabled:opacity-30"><ChevronLeft className="w-4 h-4"/>Предыдущая</button><button disabled={selectedIndex >= scenes.length - 1} onClick={() => setSelectedNumber(scenes[selectedIndex + 1].scene_number)} className="px-4 py-3 rounded-xl border border-zinc-800 flex items-center gap-2 disabled:opacity-30">Следующая<ChevronRight className="w-4 h-4"/></button></div>
        </article> : <div className="h-full flex items-center justify-center text-zinc-600">В хронике пока нет сцен.</div>}
      </main>
    </div>
  </div>;
}
