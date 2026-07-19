import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, ChevronRight, Loader2, Plus, ScrollText, Swords, Users } from 'lucide-react';
import CharacterStudio from './components/CharacterStudio';
import CampaignSetup from './components/CampaignSetup';
import PartyWaitingRoom from './components/PartyWaitingRoom';
import StoryReader from './components/StoryReader';
import { supabase, isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './lib/supabase';
import { Character } from './types';
import { generateCampaignBible, generateOpeningScene } from './game/campaign-generator';
import { CampaignPreferences, CampaignRuntime, GameMode } from './game/types';

type Screen = 'home' | 'characters' | 'setup' | 'join' | 'waiting' | 'story' | 'library';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<GameMode>('solo');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [campaignCharacters, setCampaignCharacters] = useState<Character[]>([]);
  const [campaign, setCampaign] = useState<CampaignRuntime | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRuntime[]>([]);
  const [draftCampaignId, setDraftCampaignId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinTargetId, setJoinTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [flow, setFlow] = useState<'play' | 'library' | 'join'>('play');
  const [userSessionId] = useState(() => {
    const existing = localStorage.getItem('user_session_id');
    if (existing) return existing;
    const generated = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('user_session_id', generated);
    return generated;
  });

  useEffect(() => { void loadCampaigns(); }, []);

  async function loadCampaigns() {
    if (!isSupabaseConfigured) return;
    const { data: participantRows } = await supabase.from('campaign_participants').select('campaign_id').eq('user_session_id', userSessionId);
    const ids = (participantRows || []).map((row: { campaign_id: string }) => row.campaign_id);
    const { data, error: loadError } = ids.length ? await supabase.from('campaigns').select('*').in('id', ids).order('updated_at', { ascending: false }) : { data: [], error: null };
    if (!loadError) setCampaigns((data || []).filter(row => row.bible && row.current_scene).map(rowToRuntime));
  }

  function startFlow(nextMode: GameMode) {
    setMode(nextMode); setFlow('play'); setSelectedCharacter(null); setDraftCampaignId(''); setError(''); setScreen('characters');
  }

  async function handleCharacterSelected(character: Character) {
    setSelectedCharacter(character);
    if (flow === 'library') { setScreen('home'); return; }
    if (flow === 'join') { await joinWithCharacter(character); return; }
    setScreen('setup');
  }

  async function createPartyDraft(character: Character, preferences: CampaignPreferences) {
    setLoading(true); setError('');
    const id = createCode();
    const { error: campaignError } = await supabase.from('campaigns').insert({ id, mode: 'party', status: 'setup', host_user_id: userSessionId, preferences, state: {} });
    if (campaignError) { setError(migrationMessage(campaignError.message)); setLoading(false); return; }
    const { error: participantError } = await supabase.from('campaign_participants').insert({ campaign_id: id, user_session_id: userSessionId, character_id: character.id, character_snapshot: character, is_host: true, is_ready: true });
    if (participantError) { setError(migrationMessage(participantError.message)); setLoading(false); return; }
    setDraftCampaignId(id); setScreen('waiting'); setLoading(false);
  }

  async function handleSetupStart(preferences: CampaignPreferences) {
    if (!selectedCharacter) return;
    if (mode === 'party') {
      await createPartyDraft(selectedCharacter, preferences);
      return;
    }
    await startCampaign(preferences);
  }

  async function startPreparedParty() {
    if (!draftCampaignId) return;
    setLoading(true); setError('');
    const { data, error: loadError } = await supabase.from('campaigns').select('preferences').eq('id', draftCampaignId).single();
    if (loadError || !data?.preferences) {
      setError(migrationMessage(loadError?.message || 'Не удалось загрузить настройки кампании'));
      setLoading(false);
      return;
    }
    await startCampaign(data.preferences as CampaignPreferences);
  }

  async function findCampaignToJoin() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setLoading(true); setError('');
    const { data, error: lookupError } = await supabase.from('campaigns').select('*').eq('id', code).single();
    if (lookupError || !data) { setError(migrationMessage(lookupError?.message || 'Кампания не найдена')); setLoading(false); return; }
    const { data: existing } = await supabase.from('campaign_participants').select('character_snapshot').eq('campaign_id', code).eq('user_session_id', userSessionId).maybeSingle();
    if (existing?.character_snapshot && data.status === 'playing') {
      const { data: partyRows } = await supabase.from('campaign_participants').select('character_snapshot').eq('campaign_id', code);
      setSelectedCharacter(existing.character_snapshot as Character);
      setCampaignCharacters((partyRows || []).map((row: { character_snapshot: Character }) => row.character_snapshot));
      setCampaign(rowToRuntime(data)); setScreen('story'); setLoading(false); return;
    }
    setJoinTargetId(code); setMode('party'); setFlow('join'); setScreen('characters'); setLoading(false);
  }

  async function joinWithCharacter(character: Character) {
    setLoading(true); setError('');
    const { error: joinError } = await supabase.from('campaign_participants').upsert({ campaign_id: joinTargetId, user_session_id: userSessionId, character_id: character.id, character_snapshot: character, is_host: false, is_ready: false }, { onConflict: 'campaign_id,user_session_id' });
    if (joinError) { setError(migrationMessage(joinError.message)); setLoading(false); return; }
    setDraftCampaignId(joinTargetId); setScreen('waiting'); setLoading(false);
  }

  async function startCampaign(preferences: CampaignPreferences) {
    if (!selectedCharacter) return;
    setLoading(true); setError('');
    try {
      let characters = [selectedCharacter];
      const id = mode === 'party' ? draftCampaignId : createCode();
      if (mode === 'party') {
        const { data: rows, error: participantError } = await supabase.from('campaign_participants').select('character_snapshot, is_ready, is_host').eq('campaign_id', id);
        if (participantError) throw participantError;
        if ((rows || []).some((row: { is_ready: boolean; is_host: boolean }) => !row.is_host && !row.is_ready)) throw new Error('Не все участники готовы');
        characters = (rows || []).map((row: { character_snapshot: Character }) => row.character_snapshot);
        await supabase.from('campaigns').update({ status: 'generating', preferences }).eq('id', id);
      }
      const bible = await generateCampaignBible(preferences, characters);
      const opening = await generateOpeningScene(bible, preferences, characters);
      const runtime: CampaignRuntime = {
        id, mode, status: 'playing', hostUserId: userSessionId, preferences, bible, currentScene: opening,
        state: { flags: [], inventory: [], relationships: {}, completedSceneIds: [], currentActId: opening.actId, currentSceneId: opening.id, sceneNumber: 1 },
      };
      setCampaignCharacters(characters);
      const payload = runtimeToRow(runtime);
      const operation = mode === 'party' ? supabase.from('campaigns').update(payload).eq('id', id) : supabase.from('campaigns').insert(payload);
      const { error: saveError } = await operation;
      if (saveError) {
        if (mode === 'party') throw saveError;
        setError(`Кампания запущена локально, но не сохранена: ${migrationMessage(saveError.message)}`);
      } else {
        if (mode === 'solo') await supabase.from('campaign_participants').insert({ campaign_id: id, user_session_id: userSessionId, character_id: selectedCharacter.id, character_snapshot: selectedCharacter, is_host: true, is_ready: true });
        await supabase.from('campaign_scenes').insert({ campaign_id: id, scene_id: opening.id, act_id: opening.actId, scene_number: 1, content: opening });
      }
      setCampaign(runtime); setScreen('story'); void loadCampaigns();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось создать кампанию'); }
    finally { setLoading(false); }
  }

  const openStartedCampaign = useCallback(async (id: string) => {
    const { data, error: loadError } = await supabase.from('campaigns').select('*').eq('id', id).single();
    if (loadError || !data?.current_scene) { setError(loadError?.message || 'Кампания ещё не запущена'); return; }
    const { data: participantRows } = await supabase.from('campaign_participants').select('user_session_id, character_snapshot').eq('campaign_id', id);
    const snapshots = (participantRows || []).map((row: { character_snapshot: Character }) => row.character_snapshot);
    const ownCharacter = (participantRows || []).find((row: { user_session_id: string }) => row.user_session_id === userSessionId)?.character_snapshot as Character | undefined;
    if (ownCharacter) setSelectedCharacter(ownCharacter);
    setCampaignCharacters(snapshots);
    setCampaign(rowToRuntime(data)); setScreen('story');
  }, [userSessionId]);

  async function updateCampaign(runtime: CampaignRuntime) {
    setCampaign(runtime);
    const { error: updateError } = await supabase.from('campaigns').update({ state: runtime.state, current_scene: runtime.currentScene, updated_at: new Date().toISOString() }).eq('id', runtime.id);
    if (updateError) throw updateError;
    await supabase.from('campaign_scenes').upsert({ campaign_id: runtime.id, scene_id: runtime.currentScene.id, act_id: runtime.currentScene.actId, scene_number: runtime.state.sceneNumber, content: runtime.currentScene }, { onConflict: 'campaign_id,scene_id' });
  }

  async function updateCharacter(character: Character) {
    setSelectedCharacter(character);
    setCampaignCharacters(previous => previous.map(item => item.id === character.id ? character : item));
    const { error: characterError } = await supabase.from('characters').update({ hp_current: character.hp_current, hp_max: character.hp_max, xp: character.xp, equipment: character.equipment }).eq('id', character.id);
    if (characterError) throw characterError;
    if (campaign) {
      const { error: snapshotError } = await supabase.from('campaign_participants').update({ character_snapshot: character }).eq('campaign_id', campaign.id).eq('user_session_id', userSessionId);
      if (snapshotError) throw snapshotError;
    }
  }

  const isPlaceholder = supabaseUrl.includes('your-project-id') || supabaseAnonKey === 'your-anon-key';
  if (!isSupabaseConfigured || isPlaceholder) return <ConfigurationScreen/>;
  if (screen === 'characters') return <CharacterStudio onSelect={character => void handleCharacterSelected(character)} onBack={() => setScreen(flow === 'join' ? 'join' : 'home')} title={flow === 'library' ? 'Библиотека героев' : 'Кто отправится в путь?'}/>;
  if (screen === 'setup' && selectedCharacter) return <CampaignSetup mode={mode} character={selectedCharacter} onBack={() => setScreen('characters')} onStart={handleSetupStart} loading={loading} error={error}/>;
  if (screen === 'waiting' && draftCampaignId) return <PartyWaitingRoom campaignId={draftCampaignId} currentUserId={userSessionId} onBack={() => setScreen('home')} onStartCampaign={() => void startPreparedParty()} starting={loading} externalError={error} onCampaignStarted={() => void openStartedCampaign(draftCampaignId)}/>;
  if (screen === 'story' && campaign && selectedCharacter) return <StoryReader campaign={campaign} characters={campaignCharacters.length ? campaignCharacters : [selectedCharacter]} activeCharacter={selectedCharacter} currentUserId={userSessionId} onUpdate={updateCampaign} onRemoteUpdate={setCampaign} onCharacterUpdate={updateCharacter} onLeave={() => { setCampaign(null); setScreen('home'); void loadCampaigns(); }}/>;
  if (screen === 'join') return <JoinScreen code={joinCode} setCode={setJoinCode} onBack={() => setScreen('home')} onJoin={() => void findCampaignToJoin()} loading={loading} error={error}/>;
  return <HomeScreen campaigns={campaigns} onSolo={() => startFlow('solo')} onParty={() => startFlow('party')} onJoin={() => { setError(''); setScreen('join'); }} onLibrary={() => { setFlow('library'); setScreen('characters'); }} onContinue={runtime => { setCampaign(runtime); setMode(runtime.mode); void openStartedCampaign(runtime.id); }} error={error}/>;
}

function HomeScreen({ campaigns, onSolo, onParty, onJoin, onLibrary, onContinue, error }: { campaigns: CampaignRuntime[]; onSolo: () => void; onParty: () => void; onJoin: () => void; onLibrary: () => void; onContinue: (campaign: CampaignRuntime) => void; error: string }) {
  return <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 sm:p-8"><div className="max-w-6xl mx-auto"><header className="py-10 sm:py-16"><p className="text-xs uppercase tracking-[0.35em] text-amber-500">Chronicles</p><h1 className="text-4xl sm:text-6xl font-black mt-3 max-w-3xl">Истории, которые помнят ваши решения.</h1><p className="text-zinc-500 mt-4 max-w-xl">Кооперативная текстовая RPG с заранее созданным сюжетом, личными линиями и тактическими боями.</p></header>{error && <div className="mb-5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">{error}</div>}<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><HomeAction icon={<BookOpen/>} title="Новая соло-игра" subtitle="Один герой, мгновенные решения" onClick={onSolo} primary/><HomeAction icon={<Users/>} title="Создать партию" subtitle="Код приглашения и голосование" onClick={onParty}/><HomeAction icon={<Swords/>} title="Войти по коду" subtitle="Присоединиться к кампании" onClick={onJoin}/><HomeAction icon={<ScrollText/>} title="Герои" subtitle="Создание и библиотека" onClick={onLibrary}/></div><section className="mt-12"><div className="flex justify-between items-end"><div><p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Продолжить</p><h2 className="text-2xl font-bold mt-1">Ваши кампании</h2></div></div>{campaigns.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">{campaigns.map(campaign => <button key={campaign.id} onClick={() => onContinue(campaign)} className="text-left p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-amber-500/40"><p className="text-xs text-amber-500">{campaign.mode === 'solo' ? 'Соло' : 'Партия'} · сцена {campaign.state.sceneNumber}</p><h3 className="font-bold text-lg mt-2">{campaign.bible.title}</h3><p className="text-xs text-zinc-500 mt-1 line-clamp-2">{campaign.currentScene.recap || campaign.bible.tagline}</p></button>)}</div> : <div className="mt-4 p-8 rounded-2xl border border-dashed border-zinc-800 text-center text-zinc-600">Здесь появятся начатые приключения.</div>}</section></div></div>;
}

function HomeAction({ icon, title, subtitle, onClick, primary = false }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; primary?: boolean }) { return <button onClick={onClick} className={`p-5 min-h-40 rounded-2xl border text-left flex flex-col ${primary ? 'border-amber-400 bg-amber-500 text-zinc-950' : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600'}`}><span className={`w-10 h-10 rounded-xl flex items-center justify-center ${primary ? 'bg-black/10' : 'bg-zinc-800 text-amber-400'}`}>{icon}</span><strong className="mt-auto">{title}</strong><span className={`text-xs mt-1 ${primary ? 'text-zinc-800' : 'text-zinc-500'}`}>{subtitle}</span></button>; }

function JoinScreen({ code, setCode, onBack, onJoin, loading, error }: { code: string; setCode: (code: string) => void; onBack: () => void; onJoin: () => void; loading: boolean; error: string }) { return <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4"><div className="max-w-md w-full rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-5"><button onClick={onBack} className="text-sm text-zinc-500">← На главный экран</button><div><p className="text-xs uppercase tracking-[0.2em] text-amber-500">Совместная игра</p><h1 className="text-2xl font-black mt-2">Введите код кампании</h1></div><input autoFocus value={code} onChange={event => setCode(event.target.value.toUpperCase())} onKeyDown={event => event.key === 'Enter' && onJoin()} maxLength={8} placeholder="ABC123" className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-4 text-center text-2xl font-black tracking-[0.25em] uppercase outline-none focus:border-amber-500"/>{error && <p className="text-sm text-red-400">{error}</p>}<button disabled={loading || !code.trim()} onClick={onJoin} className="w-full p-4 rounded-2xl bg-amber-500 text-zinc-950 font-bold flex justify-center gap-2 disabled:opacity-40">{loading ? <Loader2 className="animate-spin"/> : <ChevronRight/>}Продолжить</button></div></div>; }
function ConfigurationScreen() { return <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4"><div className="max-w-md text-center p-8 rounded-3xl bg-zinc-900 border border-zinc-800"><AlertTriangle className="w-12 h-12 text-amber-500 mx-auto"/><h1 className="text-2xl font-bold mt-4">Нужна конфигурация</h1><p className="text-sm text-zinc-500 mt-2">Укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.</p></div></div>; }

function createCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function migrationMessage(message: string) { return /campaigns|campaign_participants|schema cache|relation/i.test(message) ? `Новая структура БД ещё не применена. Выполните migration_interactive_rpg_v1.sql. Техническая ошибка: ${message}` : message; }
function runtimeToRow(runtime: CampaignRuntime) { return { id: runtime.id, mode: runtime.mode, status: runtime.status, host_user_id: runtime.hostUserId, title: runtime.bible.title, preferences: runtime.preferences, bible: runtime.bible, state: runtime.state, current_scene: runtime.currentScene, updated_at: new Date().toISOString() }; }
function rowToRuntime(row: any): CampaignRuntime { return { id: row.id, mode: row.mode, status: row.status, hostUserId: row.host_user_id, preferences: row.preferences, bible: row.bible, state: row.state, currentScene: row.current_scene }; }
