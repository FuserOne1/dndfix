import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, BookOpenText, Check, GitBranch, Images, Loader2, LockKeyhole, RotateCcw, ScrollText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CampaignRuntime, CampaignSavepoint } from '../game/types';
import { groupTimelines, rowToSavepoint, timelineNumberOf } from '../game/timelines';
import { HomeAtmosphere } from './HomeScreen';

interface ChronicleLibraryProps {
  campaigns: CampaignRuntime[];
  onBack: () => void;
  onContinue: (campaign: CampaignRuntime) => void;
  onReplay: (campaign: CampaignRuntime, savepoint?: CampaignSavepoint) => void | Promise<void>;
  replaying: boolean;
  error: string;
}

export default function ChronicleLibrary({ campaigns, onBack, onContinue, onReplay, replaying, error }: ChronicleLibraryProps) {
  const groups = useMemo(() => groupTimelines(campaigns), [campaigns]);
  const [selectedStoryId, setSelectedStoryId] = useState(groups[0]?.storyId || '');
  const [savepoints, setSavepoints] = useState<CampaignSavepoint[]>([]);
  const [illustrations, setIllustrations] = useState<Array<{ campaign_id: string; scene_id: string; scene_number: number; image_url: string }>>([]);
  const [saveError, setSaveError] = useState('');
  const selected = groups.find(group => group.storyId === selectedStoryId) || groups[0];

  useEffect(() => {
    if (!selected?.timelines.length) { setSavepoints([]); return; }
    const ids = selected.timelines.map(timeline => timeline.id);
    void (async () => {
      const [{ data, error: loadError }, { data: imageRows }] = await Promise.all([
        supabase.from('campaign_savepoints').select('*').in('campaign_id', ids).order('created_at', { ascending: false }),
        supabase.from('campaign_scene_images').select('campaign_id, scene_id, scene_number, image_url').in('campaign_id', ids).eq('status', 'ready').not('image_url', 'is', null).order('scene_number'),
      ]);
      if (loadError) {
        setSavepoints([]);
        setSaveError(/campaign_savepoints|schema cache|relation/i.test(loadError.message) ? 'Примените migration_story_timelines_v2.sql, чтобы открыть сохранения и повторные прохождения.' : loadError.message);
      } else {
        setSaveError('');
        setSavepoints((data || []).map(rowToSavepoint));
      }
      const uniqueImages = new Map<string, { campaign_id: string; scene_id: string; scene_number: number; image_url: string }>();
      for (const row of imageRows || []) if (row.image_url && !uniqueImages.has(row.image_url)) uniqueImages.set(row.image_url, row as { campaign_id: string; scene_id: string; scene_number: number; image_url: string });
      setIllustrations([...uniqueImages.values()]);
    })();
  }, [selected?.storyId]);

  return (
    <main className="chronicles-shell home-shell min-h-screen text-zinc-100">
      <HomeAtmosphere />
      <div className="home-content mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <header className="chronicles-header">
          <button onClick={onBack} aria-label="На главный экран"><ArrowLeft /></button>
          <div><p>Архив временных линий</p><h1>Мои хроники</h1><span>Изучайте решения, возвращайтесь к развилкам и открывайте другие финалы.</span></div>
          <div className="chronicles-count"><b>{campaigns.length}</b><small>прохождений</small></div>
        </header>

        {(error || saveError) && <div className="home-error mt-5">{error || saveError}</div>}

        {!groups.length ? <EmptyChronicles onBack={onBack} /> : <div className="chronicles-layout">
          <aside className="chronicles-stories" aria-label="Персональные истории">
            <p className="chronicles-label">Истории</p>
            {groups.map(group => {
              const finished = group.timelines.filter(item => item.status === 'finished').length;
              return <button key={group.storyId} onClick={() => setSelectedStoryId(group.storyId)} className={group.storyId === selected?.storyId ? 'is-selected' : ''}>
                <span className="chronicles-story-mark"><BookOpenText size={19} /></span>
                <span><strong>{group.title}</strong><small>{group.timelines.length} линий · {finished} финалов</small></span>
                <ArrowRight size={15} />
              </button>;
            })}
          </aside>

          {selected && <section className="chronicles-detail">
            <div className="chronicles-cover">
              <div><p>Персональная история</p><h2>{selected.title}</h2><span>{selected.timelines[0].bible.tagline}</span></div>
              <button disabled={replaying} onClick={() => void onReplay(selected.timelines[0])}>{replaying ? <Loader2 className="animate-spin" /> : <RotateCcw />}Новая временная линия</button>
            </div>

            <EndingGallery campaign={selected.timelines[0]} timelines={selected.timelines} />

            {illustrations.length > 0 && <section className="chronicle-gallery"><div className="chronicles-block-heading"><div><p>Память истории</p><h3>Открытые иллюстрации</h3></div><span>{illustrations.length} изображений</span></div><div>{illustrations.map(image => <figure key={image.image_url}><img src={image.image_url} alt={`Иллюстрация сцены ${image.scene_number}`} loading="lazy"/><figcaption><Images size={13}/>Сцена {image.scene_number}</figcaption></figure>)}</div></section>}

            <div className="chronicles-block-heading"><div><p>Прохождения</p><h3>Временные линии</h3></div><span>Каждая линия хранится отдельно</span></div>
            <div className="timeline-list">
              {selected.timelines.map(timeline => {
                const points = savepoints.filter(point => point.campaignId === timeline.id);
                return <article key={timeline.id} className="timeline-card">
                  <div className="timeline-rail"><span>{timelineNumberOf(timeline)}</span><i /></div>
                  <div className="timeline-main">
                    <div className="timeline-title"><div><small>{timeline.mode === 'solo' ? 'Соло' : 'Партия'} · линия {timelineNumberOf(timeline)}</small><strong>{timeline.endingTitle || (timeline.status === 'finished' ? 'Завершённая хроника' : timeline.currentScene.title)}</strong></div><span className={timeline.status === 'finished' ? 'is-finished' : ''}>{timeline.status === 'finished' ? 'Финал' : `Сцена ${timeline.state.sceneNumber}`}</span></div>
                    <p>{timeline.currentScene.recap || timeline.bible.tagline}</p>
                    <div className="timeline-actions">
                      {timeline.status !== 'finished' && <button onClick={() => onContinue(timeline)}><BookOpenText size={15} />Продолжить</button>}
                      <button disabled={replaying} onClick={() => void onReplay(timeline)}><RotateCcw size={15} />С начала</button>
                    </div>
                    {points.length > 0 && <div className="savepoint-list"><p><Bookmark size={13} /> Сохранения</p>{points.map(point => <button key={point.id} disabled={replaying} onClick={() => void onReplay(timeline, point)}><span><b>{point.kind === 'ending' ? 'Финал' : point.kind === 'manual' ? 'Ручное' : 'Развилка'}</b>{point.label}</span><small>сцена {point.sceneNumber}<GitBranch size={13} /></small></button>)}</div>}
                  </div>
                </article>;
              })}
            </div>
          </section>}
        </div>}
      </div>
    </main>
  );
}

function EndingGallery({ campaign, timelines }: { campaign: CampaignRuntime; timelines: CampaignRuntime[] }) {
  const unlocked = new Set(timelines.map(item => item.endingId).filter(Boolean));
  return <section className="ending-gallery"><div className="chronicles-block-heading"><div><p>Нити судьбы</p><h3>Возможные финалы</h3></div><span>{unlocked.size}/{campaign.bible.endings.length || 1} открыто</span></div><div>{campaign.bible.endings.map((ending, index) => {
    const isOpen = unlocked.has(ending.id);
    return <article key={ending.id} className={isOpen ? 'is-open' : ''}><span>{isOpen ? <Check size={17} /> : <LockKeyhole size={16} />}</span><small>Финал {String(index + 1).padStart(2, '0')}</small><strong>{isOpen ? ending.title : 'Неизвестная судьба'}</strong><p>{isOpen ? ending.condition : 'Его условия скрыты, пока эта нить не будет прожита.'}</p></article>;
  })}</div></section>;
}

function EmptyChronicles({ onBack }: { onBack: () => void }) {
  return <div className="chronicles-empty"><ScrollText size={34} /><h2>Архив пока пуст</h2><p>Законченные и текущие истории появятся здесь вместе с сохранениями и открытыми финалами.</p><button onClick={onBack}>Вернуться и начать историю <ArrowRight size={16} /></button></div>;
}
