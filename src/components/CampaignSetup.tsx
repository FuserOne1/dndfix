import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, Loader2, Swords, Users } from 'lucide-react';
import { Character } from '../types';
import { CampaignPreferences, CampaignTone, GameMode } from '../game/types';
import { supabase } from '../lib/supabase';

interface CampaignSetupProps {
  mode: GameMode;
  character: Character;
  onBack: () => void;
  onStart: (preferences: CampaignPreferences) => void | Promise<void>;
  loading?: boolean;
  error?: string;
  sessionCode?: string;
}

const TONES: Array<{ id: CampaignTone; label: string }> = [
  { id: 'heroic', label: 'Героическое' }, { id: 'dark', label: 'Мрачное' }, { id: 'mystery', label: 'Детективное' },
  { id: 'adventure', label: 'Приключенческое' }, { id: 'horror', label: 'Хоррор' }, { id: 'comedy', label: 'С юмором' },
];

export default function CampaignSetup({ mode, character, onBack, onStart, loading = false, error = '', sessionCode }: CampaignSetupProps) {
  const [participants, setParticipants] = useState<Array<{ character_snapshot: Character; is_ready: boolean; is_host: boolean }>>([]);
  const [preferences, setPreferences] = useState<CampaignPreferences>({
    mode, length: 'short', tones: ['dark', 'mystery'], setting: '', premise: '', combatFrequency: 'balanced', difficulty: 'normal', branching: 'balanced', themes: '', boundaries: '', customWish: '', hideLockedChoices: false, voteTimerSeconds: mode === 'party' ? null : null,
  });
  const loadParticipants = useCallback(async () => {
    if (!sessionCode) return;
    const { data } = await supabase.from('campaign_participants').select('character_snapshot, is_ready, is_host').eq('campaign_id', sessionCode).order('joined_at');
    setParticipants((data || []) as Array<{ character_snapshot: Character; is_ready: boolean; is_host: boolean }>);
  }, [sessionCode]);
  useEffect(() => {
    if (!sessionCode) return;
    void loadParticipants();
    const channel = supabase.channel(`setup-party:${sessionCode}`).on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_participants', filter: `campaign_id=eq.${sessionCode}` }, () => void loadParticipants()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadParticipants, sessionCode]);
  const allReady = mode === 'solo' || participants.every(participant => participant.is_host || participant.is_ready);
  const preparingPartyRoom = mode === 'party' && !sessionCode;

  function toggleTone(tone: CampaignTone) {
    setPreferences(previous => ({ ...previous, tones: previous.tones.includes(tone) ? previous.tones.filter(item => item !== tone) : previous.tones.length < 3 ? [...previous.tones, tone] : previous.tones }));
  }

  return <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 sm:p-8"><div className="max-w-5xl mx-auto space-y-6">
    <div className="flex items-start gap-4"><button onClick={onBack} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900"><ArrowLeft/></button><div><p className="text-xs uppercase tracking-[0.22em] text-amber-500">Нулевая сессия</p><h1 className="text-3xl font-black">Настройте приключение</h1><p className="text-zinc-500 mt-1">ИИ создаст сюжетный каркас вокруг героев и этих пожеланий.</p></div></div>
    {sessionCode && <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10"><p className="text-xs text-emerald-400 uppercase">Код совместной игры</p><strong className="text-2xl tracking-[0.25em]">{sessionCode}</strong><p className="text-xs text-zinc-500 mt-1">Участники смогут присоединиться после применения новой миграции мультиплеера.</p></div>}
    {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>}
    <div className="grid lg:grid-cols-[1fr_280px] gap-5">
      <div className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-7">
        <Field title="Длина кампании"><Segment value={preferences.length} options={[['short','Короткая'],['medium','Средняя'],['long','Длинная']]} onChange={length => setPreferences({ ...preferences, length: length as CampaignPreferences['length'] })}/></Field>
        <Field title="Настроение" hint="До трёх вариантов"><div className="flex flex-wrap gap-2">{TONES.map(tone => <button key={tone.id} onClick={() => toggleTone(tone.id)} className={`px-3 py-2 rounded-xl border text-sm ${preferences.tones.includes(tone.id) ? 'border-amber-400 bg-amber-500/10 text-amber-200' : 'border-zinc-800 text-zinc-500'}`}>{tone.label}</button>)}</div></Field>
        <div className="grid sm:grid-cols-2 gap-4"><TextField title="Мир и сеттинг" value={preferences.setting} placeholder="Острова над вечным штормом…" onChange={setting => setPreferences({ ...preferences, setting })}/><TextField title="Завязка" value={preferences.premise} placeholder="Герои получают одинаковое письмо…" onChange={premise => setPreferences({ ...preferences, premise })}/></div>
        <div className="grid sm:grid-cols-3 gap-4"><Field title="Бои"><Select value={preferences.combatFrequency} onChange={combatFrequency => setPreferences({ ...preferences, combatFrequency: combatFrequency as CampaignPreferences['combatFrequency'] })} options={[['rare','Редкие'],['balanced','Умеренные'],['frequent','Частые']]}/></Field><Field title="Сложность"><Select value={preferences.difficulty} onChange={difficulty => setPreferences({ ...preferences, difficulty: difficulty as CampaignPreferences['difficulty'] })} options={[['story','Сюжетная'],['normal','Обычная'],['dangerous','Опасная']]}/></Field><Field title="Ветвление"><Select value={preferences.branching} onChange={branching => setPreferences({ ...preferences, branching: branching as CampaignPreferences['branching'] })} options={[['focused','Фокус'],['balanced','Баланс'],['wide','Широкое']]}/></Field></div>
        <div className="grid sm:grid-cols-2 gap-4"><TextField title="Желаемые темы" value={preferences.themes} placeholder="Предательство, древние руины…" onChange={themes => setPreferences({ ...preferences, themes })}/><TextField title="Запреты и границы" value={preferences.boundaries} placeholder="Без жестокости к детям…" onChange={boundaries => setPreferences({ ...preferences, boundaries })}/></div>
        <TextField area title="Свободное пожелание" value={preferences.customWish} placeholder="В финале хочу сложный моральный выбор…" onChange={customWish => setPreferences({ ...preferences, customWish })}/>
      </div>
      <aside className="space-y-4"><div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"><p className="text-xs text-zinc-500 uppercase">Режим</p><div className="flex items-center gap-2 mt-2 font-bold">{mode === 'solo' ? <BookOpen className="text-amber-400"/> : <Users className="text-amber-400"/>}{mode === 'solo' ? 'Одиночная игра' : 'Совместная игра'}</div></div><div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"><p className="text-xs text-zinc-500 uppercase">Главный герой</p><strong className="block mt-2">{character.name}</strong><span className="text-xs text-zinc-500">{character.race} · {character.class}</span></div>{mode === 'party' && sessionCode && <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"><div className="flex justify-between"><p className="text-xs text-zinc-500 uppercase">Партия</p><span className="text-xs text-zinc-600">{participants.length}</span></div><div className="mt-2 space-y-2">{participants.map((participant,index) => <div key={index} className="flex justify-between text-xs"><span>{participant.character_snapshot.name}</span><span className={participant.is_host || participant.is_ready ? 'text-emerald-400' : 'text-zinc-600'}>{participant.is_host || participant.is_ready ? 'готов' : 'ждём'}</span></div>)}</div></div>}<button disabled={loading || preferences.tones.length === 0 || !allReady} onClick={() => void onStart(preferences)} className="w-full p-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="animate-spin"/> : <Swords/>}{loading ? preparingPartyRoom ? 'Создаём комнату…' : 'Создаём кампанию…' : !allReady ? 'Ждём готовности' : preparingPartyRoom ? 'Создать комнату' : 'Начать приключение'}</button><p className="text-[11px] text-zinc-600 text-center">{preparingPartyRoom ? 'Сначала появится код приглашения. Сюжет не начнёт создаваться, пока ведущий не соберёт игроков и не запустит кампанию.' : 'Каркас и первая сцена будут созданы только после нажатия этой кнопки. Это может занять до минуты.'}</p></aside>
    </div>
  </div></div>;
}

function Field({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) { return <div><div className="flex justify-between mb-2"><label className="text-sm font-bold">{title}</label>{hint && <span className="text-xs text-zinc-600">{hint}</span>}</div>{children}</div>; }
function TextField({ title, value, placeholder, onChange, area = false }: { title: string; value: string; placeholder: string; onChange: (value: string) => void; area?: boolean }) { return <Field title={title}>{area ? <textarea rows={3} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500 resize-y"/> : <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500"/>}</Field>; }
function Segment({ value, options, onChange }: { value: string; options: string[][]; onChange: (value: string) => void }) { return <div className="grid grid-cols-3 gap-2">{options.map(([id,label]) => <button key={id} onClick={() => onChange(id)} className={`p-3 rounded-xl border text-sm ${value === id ? 'border-amber-400 bg-amber-500/10 text-amber-200' : 'border-zinc-800 text-zinc-500'}`}>{label}</button>)}</div>; }
function Select({ value, options, onChange }: { value: string; options: string[][]; onChange: (value: string) => void }) { return <select value={value} onChange={event => onChange(event.target.value)} className="min-h-11 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-sm">{options.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select>; }
