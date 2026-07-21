import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Activity, ArrowLeft, BookMarked, Compass, HeartHandshake, Loader2, MapPin, ScrollText, Shield, Sparkles } from 'lucide-react';
import type { Character } from '../types';
import type { CampaignEvent, CampaignRuntime } from '../game/types';
import { normalizeSystems, relationshipStatus, stableKey } from '../game/world-state';
import { loadCampaignEvents } from '../game/world-state-store';
import { supabase } from '../lib/supabase';

type JournalTab = 'hero' | 'relations' | 'map' | 'journal';

export default function AdventureJournal({ campaign, character, onClose }: { campaign: CampaignRuntime; character: Character; onClose: () => void }) {
  const [tab, setTab] = useState<JournalTab>('hero');
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState('');
  const systems = normalizeSystems(campaign.state.systems);

  const loadEvents = useCallback(async () => {
    try { setEvents(await loadCampaignEvents(campaign.id)); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось загрузить журнал событий'); }
    finally { setLoadingEvents(false); }
  }, [campaign.id]);

  useEffect(() => {
    void loadEvents();
    const channel = supabase.channel(`campaign-journal:${campaign.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_events', filter: `campaign_id=eq.${campaign.id}` }, () => void loadEvents()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [campaign.id, loadEvents]);

  const tabs: Array<{ id: JournalTab; label: string; icon: typeof Activity; count?: number }> = [
    { id: 'hero', label: 'Герой', icon: Activity, count: systems.conditions.filter(condition => condition.characterId === character.id).length },
    { id: 'relations', label: 'Связи', icon: HeartHandshake, count: systems.relationships.length },
    { id: 'map', label: 'Карта', icon: Compass, count: systems.locations.length },
    { id: 'journal', label: 'Журнал', icon: BookMarked, count: systems.quests.filter(quest => quest.status === 'active').length },
  ];

  return <div className="fixed inset-0 z-[98] bg-[#09090b] text-zinc-100 overflow-hidden">
    <header className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center px-3 sm:px-5"><div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0"><button onClick={onClose} className="p-2.5 rounded-xl border border-zinc-800" aria-label="Закрыть журнал"><ArrowLeft className="w-4 h-4"/></button><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.2em] text-amber-500">Системная память · версия {campaign.state.version || 0}</p><h1 className="font-bold truncate">Журнал приключения</h1></div></div><span className="hidden sm:block text-xs text-zinc-600">{campaign.bible.title}</span></div></header>
    <div className="max-w-7xl mx-auto h-[calc(100vh-4rem)] grid lg:grid-cols-[230px_1fr]">
      <nav className="border-b lg:border-b-0 lg:border-r border-zinc-800 p-2 lg:p-3 flex lg:flex-col gap-2 overflow-x-auto">
        {tabs.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`min-w-[118px] lg:min-w-0 w-full p-3 rounded-xl border flex items-center gap-3 text-left ${tab === item.id ? 'border-amber-500/40 bg-amber-500/10 text-amber-100' : 'border-transparent text-zinc-500 hover:bg-zinc-900'}`}><item.icon className="w-4 h-4 shrink-0"/><span className="text-sm font-bold flex-1">{item.label}</span>{item.count !== undefined && <span className="text-[10px] rounded-full bg-zinc-800 px-2 py-0.5">{item.count}</span>}</button>)}
      </nav>
      <main className="overflow-y-auto p-4 sm:p-8"><div className="max-w-4xl mx-auto">
        {error && <div className="mb-5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">{error}</div>}
        {tab === 'hero' && <HeroTab campaign={campaign} character={character}/>} 
        {tab === 'relations' && <RelationsTab relationships={systems.relationships}/>} 
        {tab === 'map' && <MapTab campaign={campaign}/>} 
        {tab === 'journal' && <JournalTabContent campaign={campaign} events={events} loading={loadingEvents}/>} 
      </div></main>
    </div>
  </div>;
}

function HeroTab({ campaign, character }: { campaign: CampaignRuntime; character: Character }) {
  const systems = normalizeSystems(campaign.state.systems);
  const conditions = systems.conditions.filter(condition => condition.characterId === character.id);
  const hook = campaign.bible.characterHooks.find(item => item.characterName === character.name)?.hook;
  return <div className="space-y-6"><SectionTitle eyebrow="Состояние персонажа" title={character.name} subtitle={`${character.race} · ${character.class} · уровень ${character.level}`}/>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Stat label="Здоровье" value={`${character.hp_current}/${character.hp_max}`} tone="red"/><Stat label="Опыт" value={String(character.xp)}/><Stat label="Золото" value={String(character.gold || 0)} tone="amber"/><Stat label="Сцена" value={String(campaign.state.sceneNumber)}/></div>
    <Panel title="Активные состояния" icon={<Shield className="w-4 h-4"/>}>{conditions.length ? <div className="grid sm:grid-cols-2 gap-3">{conditions.map(condition => <div key={`${condition.characterId}:${condition.key}`} className={`p-4 rounded-xl border ${condition.severity === 'critical' ? 'border-red-500/40 bg-red-500/10' : condition.severity === 'major' ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800 bg-zinc-950/50'}`}><strong className="text-sm">{condition.name}</strong><p className="text-xs text-zinc-500 mt-1 leading-relaxed">{condition.description}</p>{condition.expiresAtScene && <span className="text-[10px] text-zinc-600 mt-2 block">до сцены {condition.expiresAtScene}</span>}</div>)}</div> : <Empty text="Нет активных состояний."/>}</Panel>
    <Panel title="Личная линия" icon={<Sparkles className="w-4 h-4"/>}><p className="text-sm leading-7 text-zinc-300">{hook || character.backstory_data?.goal || 'Личная цель ещё не проявилась в истории.'}</p></Panel>
    <Panel title="Черты и опыт" icon={<Activity className="w-4 h-4"/>}><div className="flex flex-wrap gap-2">{(character.rules_data?.traits || []).map(trait => <span key={trait} className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">{trait}</span>)}{!character.rules_data?.traits?.length && <Empty text="Постоянные черты пока не записаны."/>}</div></Panel>
  </div>;
}

function RelationsTab({ relationships }: { relationships: ReturnType<typeof normalizeSystems>['relationships'] }) {
  return <div className="space-y-6"><SectionTitle eyebrow="NPC и фракции" title="Связи" subtitle="Каждое изменение сохраняется вместе с причиной и сценой."/>{relationships.length ? <div className="grid md:grid-cols-2 gap-4">{relationships.map(item => { const score = Math.round((item.trust + item.respect + item.affection - Math.max(0, item.fear)) / 3); return <div key={item.targetKey} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"><div className="flex justify-between gap-3"><div><span className="text-[10px] uppercase text-zinc-600">{item.targetType === 'faction' ? 'Фракция' : 'Персонаж'}</span><h3 className="font-bold mt-1">{item.targetName}</h3></div><span className={`text-xs h-fit px-2 py-1 rounded-lg ${score >= 10 ? 'bg-emerald-500/10 text-emerald-400' : score <= -10 ? 'bg-red-500/10 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>{relationshipStatus(score)}</span></div><div className="mt-4 space-y-2"><RelationBar label="Доверие" value={item.trust}/><RelationBar label="Уважение" value={item.respect}/><RelationBar label="Страх" value={item.fear}/><RelationBar label="Привязанность" value={item.affection}/></div><p className="text-xs text-zinc-500 mt-4 border-t border-zinc-800 pt-3">{item.reason || 'Причина отношения пока неизвестна.'}</p></div>; })}</div> : <Empty text="Значимые отношения ещё не сформированы."/>}</div>;
}

function MapTab({ campaign }: { campaign: CampaignRuntime }) {
  const systems = normalizeSystems(campaign.state.systems);
  const currentKey = stableKey(campaign.currentScene.location);
  return <div className="space-y-6"><SectionTitle eyebrow="Исследованный мир" title="Карта местности" subtitle="Только открытые движком локации и подтверждённые маршруты."/>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{systems.locations.map(location => <div key={location.key} className={`relative rounded-2xl border p-5 ${location.key === currentKey ? 'border-amber-400 bg-amber-500/10' : location.status === 'blocked' ? 'border-red-500/20 bg-red-500/5' : 'border-zinc-800 bg-zinc-900/60'}`}><MapPin className={`w-5 h-5 ${location.key === currentKey ? 'text-amber-400' : 'text-zinc-600'}`}/><h3 className="font-bold mt-3">{location.name}</h3><p className="text-xs text-zinc-500 mt-2 min-h-8">{location.description || 'Подробности ещё не изучены.'}</p><div className="flex items-center justify-between mt-4 text-[10px] uppercase"><span className="text-zinc-600">{location.status === 'visited' ? 'Посещено' : location.status === 'blocked' ? 'Закрыто' : location.status === 'rumored' ? 'Слух' : 'Открыто'}</span><span className="text-red-400">опасность {location.danger}/5</span></div><div className="flex gap-1 mt-2">{location.services.trade && <Tag text="торговля"/>}{location.services.rest && <Tag text="отдых"/>}{location.services.stash && <Tag text="сундук"/>}</div></div>)}</div>
    <Panel title="Маршруты" icon={<Compass className="w-4 h-4"/>}>{systems.routes.length ? <div className="space-y-2">{systems.routes.map(route => <div key={route.key} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between gap-3"><span className="text-sm">{route.label}</span><span className={route.status === 'blocked' ? 'text-red-400 text-xs' : 'text-zinc-600 text-xs'}>{route.status === 'blocked' ? 'закрыт' : `опасность ${route.danger}/5`}</span></div>)}</div> : <Empty text="Группа ещё не проложила ни одного маршрута."/>}</Panel>
  </div>;
}

function JournalTabContent({ campaign, events, loading }: { campaign: CampaignRuntime; events: CampaignEvent[]; loading: boolean }) {
  const systems = normalizeSystems(campaign.state.systems);
  return <div className="space-y-6"><SectionTitle eyebrow="Цели, улики и последствия" title="Журнал кампании" subtitle="Факты из базы данных, а не пересказ памяти ИИ."/>
    <Panel title="Задания" icon={<ScrollText className="w-4 h-4"/>}>{systems.quests.length ? <div className="space-y-3">{systems.quests.map(quest => <div key={quest.key} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50"><div className="flex justify-between gap-3"><strong className="text-sm">{quest.title}</strong><Tag text={quest.status === 'active' ? 'активно' : quest.status === 'completed' ? 'завершено' : 'провалено'}/></div><p className="text-xs text-zinc-500 mt-2">{quest.description}</p><p className="text-xs text-amber-300 mt-3">Текущий этап: {quest.stage}</p></div>)}</div> : <Empty text="Активных заданий нет."/>}</Panel>
    <Panel title="Улики" icon={<BookMarked className="w-4 h-4"/>}>{systems.clues.length ? <div className="grid sm:grid-cols-2 gap-3">{systems.clues.map(clue => <div key={clue.key} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50"><strong className="text-sm">{clue.title}</strong><p className="text-xs text-zinc-500 mt-2">{clue.description}</p><span className="text-[10px] uppercase text-violet-400 mt-3 block">{clue.reliability === 'confirmed' ? 'подтверждено' : clue.reliability === 'likely' ? 'вероятно' : 'не проверено'}</span></div>)}</div> : <Empty text="Подтверждённых улик пока нет."/>}</Panel>
    <Panel title="История изменений" icon={<Activity className="w-4 h-4"/>}>{loading ? <div className="flex items-center text-sm text-zinc-500"><Loader2 className="w-4 h-4 animate-spin mr-2"/>Загружаем события…</div> : events.length ? <div className="space-y-1">{events.map(event => <div key={event.id || event.sequence} className="grid grid-cols-[34px_1fr] gap-3 py-3 border-b border-zinc-800/70 last:border-0"><span className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-[10px] text-zinc-600">{event.sequence}</span><div><p className="text-sm text-zinc-300">{event.summary}</p><span className="text-[10px] text-zinc-600">{event.eventType === 'choice_resolved' ? 'Решение группы' : 'Системное событие'}{event.sceneId ? ` · ${event.sceneId}` : ''}</span></div></div>)}</div> : <Empty text="Журнал событий пуст."/>}</Panel>
  </div>;
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div><p className="text-[10px] uppercase tracking-[0.2em] text-amber-500">{eyebrow}</p><h2 className="text-3xl sm:text-4xl font-black mt-2">{title}</h2><p className="text-sm text-zinc-500 mt-2">{subtitle}</p></div>; }
function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5"><h3 className="font-bold flex items-center gap-2 mb-4 text-zinc-200">{icon}{title}</h3>{children}</section>; }
function Stat({ label, value, tone = 'zinc' }: { label: string; value: string; tone?: 'zinc' | 'red' | 'amber' }) { return <div className={`p-4 rounded-2xl border ${tone === 'red' ? 'border-red-500/20 bg-red-500/5' : tone === 'amber' ? 'border-amber-500/20 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/60'}`}><span className="text-[10px] uppercase text-zinc-600">{label}</span><strong className="block text-xl mt-1">{value}</strong></div>; }
function RelationBar({ label, value }: { label: string; value: number }) { const width = Math.abs(value) / 2; return <div><div className="flex justify-between text-[10px] text-zinc-600"><span>{label}</span><span>{value > 0 ? '+' : ''}{value}</span></div><div className="h-1.5 bg-zinc-950 rounded-full mt-1 overflow-hidden"><div className={`h-full rounded-full ${value >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${width}%`, marginLeft: value < 0 ? `${50 - width}%` : '50%' }}/></div></div>; }
function Tag({ text }: { text: string }) { return <span className="px-2 py-1 rounded-lg bg-zinc-800 text-[10px] text-zinc-400">{text}</span>; }
function Empty({ text }: { text: string }) { return <p className="text-sm text-zinc-600">{text}</p>; }
