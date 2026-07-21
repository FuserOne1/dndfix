import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight, Loader2, Plus, Users } from 'lucide-react';
import { supabase, isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './lib/supabase';
import { Character } from './types';
import { generateCampaignPackage } from './game/campaign-generator';
import { CampaignPreferences, CampaignRuntime, CampaignSavepoint, GameMode } from './game/types';
import { createDirectorState } from './game/scene-director';
import { createInitialSystems, normalizeSystems } from './game/world-state';
import { bootstrapPatch, commitWorldEvent } from './game/world-state-store';
import HomeScreen, { HomeAtmosphere } from './components/HomeScreen';

const InventoryPanel = lazy(() => import('./components/InventoryPanel'));
const CharacterStudio = lazy(() => import('./components/CharacterStudio'));
const CampaignSetup = lazy(() => import('./components/CampaignSetup'));
const PartyWaitingRoom = lazy(() => import('./components/PartyWaitingRoom'));
const StoryReader = lazy(() => import('./components/StoryReader'));
const ChronicleLibrary = lazy(() => import('./components/ChronicleLibrary'));

type Screen = 'home' | 'characters' | 'setup' | 'join' | 'waiting' | 'story' | 'library' | 'inventory' | 'chronicles';

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
  const [inventoryReturn, setInventoryReturn] = useState<Screen>('characters');
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
      await openStartedCampaign(code); setLoading(false); return;
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
      const { bible, opening } = await generateCampaignPackage(preferences, characters);
      let runtime: CampaignRuntime = {
        id, storyId: id, timelineNumber: 1, mode, status: 'playing', hostUserId: userSessionId, preferences, bible, currentScene: opening,
        state: { version: 0, flags: [], inventory: [], relationships: {}, completedSceneIds: [], currentActId: opening.actId, currentSceneId: opening.id, sceneNumber: 1, director: createDirectorState(opening, characters), systems: createInitialSystems(bible, opening, characters) },
      };
      setCampaignCharacters(characters);
      const { error: storyError } = await supabase.from('campaign_stories').upsert({ id, owner_user_id: userSessionId, title: bible.title, preferences, bible, opening_scene: opening, updated_at: new Date().toISOString() });
      if (storyError) throw new Error(timelineMigrationMessage(storyError.message));
      const payload = runtimeToRow(runtime);
      const operation = mode === 'party' ? supabase.from('campaigns').update(payload).eq('id', id) : supabase.from('campaigns').insert(payload);
      const { error: saveError } = await operation;
      if (saveError) {
        throw new Error(`Кампания не запущена: системное состояние должно быть сохранено в БД. ${migrationMessage(saveError.message)}`);
      } else {
        if (mode === 'solo') await supabase.from('campaign_participants').insert({ campaign_id: id, user_session_id: userSessionId, character_id: selectedCharacter.id, character_snapshot: selectedCharacter, is_host: true, is_ready: true });
        await supabase.from('campaign_scenes').insert({ campaign_id: id, scene_id: opening.id, act_id: opening.actId, scene_number: 1, content: opening });
        const version = await commitWorldEvent({ campaignId: id, expectedVersion: 0, eventType: 'campaign_started', sceneId: opening.id, actorId: selectedCharacter.id, summary: `Кампания «${bible.title}» началась в локации «${opening.location}».`, patch: bootstrapPatch(runtime.state.systems!), systems: runtime.state.systems!, campaignState: runtime.state, currentScene: opening });
        runtime = { ...runtime, state: { ...runtime.state, version } };
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
    try {
      let runtime = rowToRuntime(data);
      if (!runtime.state.version) {
        const systems = normalizeSystems(runtime.state.systems || createInitialSystems(runtime.bible, runtime.currentScene, snapshots));
        const version = await commitWorldEvent({ campaignId: runtime.id, expectedVersion: 0, eventType: 'campaign_bootstrapped', sceneId: runtime.currentScene.id, actorId: ownCharacter?.id, summary: 'Системное состояние существующей кампании перенесено в журнал.', patch: bootstrapPatch(systems), systems, campaignState: { ...runtime.state, systems }, currentScene: runtime.currentScene });
        runtime = { ...runtime, state: { ...runtime.state, version, systems } };
      }
      setCampaign(runtime); setScreen('story');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось загрузить системное состояние кампании');
    }
  }, [userSessionId]);

  async function updateCampaign(runtime: CampaignRuntime) {
    setCampaign(runtime);
    const { error: updateError } = await supabase.from('campaigns').update({ status: runtime.status, state: runtime.state, current_scene: runtime.currentScene, ending_id: runtime.endingId || null, ending_title: runtime.endingTitle || null, finished_at: runtime.finishedAt || null, updated_at: new Date().toISOString() }).eq('id', runtime.id);
    if (updateError) throw updateError;
    await supabase.from('campaign_scenes').upsert({ campaign_id: runtime.id, scene_id: runtime.currentScene.id, act_id: runtime.currentScene.actId, scene_number: runtime.state.sceneNumber, content: runtime.currentScene }, { onConflict: 'campaign_id,scene_id' });
  }

  async function updateCharacter(character: Character) {
    setSelectedCharacter(previous => previous?.id === character.id ? character : previous);
    setCampaignCharacters(previous => previous.map(item => item.id === character.id ? character : item));
    // Повторные временные линии изолированы: старое сохранение не должно
    // откатывать развитие многоразового героя в общей библиотеке.
    if (!campaign || (campaign.timelineNumber || 1) === 1) {
      const { error: characterError } = await supabase.from('characters').update({ level: character.level, hp_current: character.hp_current, hp_max: character.hp_max, xp: character.xp, gold: character.gold || 0, equipment: character.equipment, inventory_data: character.inventory_data }).eq('id', character.id);
      if (characterError) throw characterError;
    }
    if (campaign) {
      const { error: snapshotError } = await supabase.from('campaign_participants').update({ character_snapshot: character }).eq('campaign_id', campaign.id).eq('character_id', character.id);
      if (snapshotError) throw snapshotError;
    }
  }

  async function replayCampaign(source: CampaignRuntime, savepoint?: CampaignSavepoint) {
    if (source.mode === 'party' && source.hostUserId !== userSessionId) {
      setError('Новую временную линию совместной истории может открыть только ведущий.');
      return;
    }
    setLoading(true); setError('');
    try {
      const storyId = source.storyId || source.id;
      const [{ data: story, error: storyError }, { data: participantRows, error: participantError }, { data: latest }] = await Promise.all([
        supabase.from('campaign_stories').select('opening_scene').eq('id', storyId).maybeSingle(),
        supabase.from('campaign_participants').select('user_session_id, character_id, character_snapshot, is_host').eq('campaign_id', source.id).order('joined_at'),
        supabase.from('campaigns').select('timeline_number').eq('story_id', storyId).order('timeline_number', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (storyError) throw new Error(timelineMigrationMessage(storyError.message));
      if (participantError) throw participantError;

      let opening = savepoint?.currentScene || story?.opening_scene;
      if (!opening) {
        const { data: firstScene, error: sceneError } = await supabase.from('campaign_scenes').select('content').eq('campaign_id', source.id).order('scene_number').limit(1).maybeSingle();
        if (sceneError || !firstScene?.content) throw new Error(sceneError?.message || 'Первая сцена истории не найдена');
        opening = firstScene.content;
      }
      const snapshots = savepoint?.characterSnapshots?.length ? savepoint.characterSnapshots : (participantRows || []).map((row: any) => row.character_snapshot as Character);
      if (!snapshots.length) throw new Error('Для новой временной линии не найден ни один герой.');
      const timelineNumber = Math.max(1, Number(latest?.timeline_number || 1)) + 1;
      const id = createCode();
      const freshState = { version: 0, flags: [], inventory: [], relationships: {}, completedSceneIds: [], currentActId: opening.actId, currentSceneId: opening.id, sceneNumber: 1, director: createDirectorState(opening, snapshots), systems: createInitialSystems(source.bible, opening, snapshots) };
      const state = savepoint ? { ...savepoint.state, version: 0, currentSceneId: opening.id, currentActId: opening.actId } : freshState;
      let runtime: CampaignRuntime = { ...source, id, storyId, timelineNumber, parentCampaignId: source.id, status: 'playing', endingId: undefined, endingTitle: undefined, finishedAt: undefined, state, currentScene: opening };
      const { error: campaignError } = await supabase.from('campaigns').insert(runtimeToRow(runtime));
      if (campaignError) throw new Error(timelineMigrationMessage(campaignError.message));

      const replayParticipants = snapshots.map((snapshot, index) => {
        const original = (participantRows || []).find((row: any) => row.character_snapshot?.id === snapshot.id) || participantRows?.[index];
        return { campaign_id: id, user_session_id: original?.user_session_id || (index === 0 ? userSessionId : `replay_${id}_${index}`), character_id: original ? original.character_id : snapshot.id || null, character_snapshot: snapshot, is_host: original?.user_session_id === source.hostUserId || (!original && index === 0), is_ready: true };
      });
      const { error: participantsError } = await supabase.from('campaign_participants').insert(replayParticipants);
      if (participantsError) throw participantsError;

      if (savepoint) {
        // Завершённые сцены копируются с результатами, а сама точка развилки —
        // без старого решения, иначе новая линия визуально наследовала бы чужой выбор.
        const { data: scenes } = await supabase.from('campaign_scenes').select('scene_id, act_id, scene_number, content, resolution').eq('campaign_id', source.id).lt('scene_number', savepoint.sceneNumber).order('scene_number');
        if (scenes?.length) await supabase.from('campaign_scenes').insert(scenes.map((row: any) => ({ ...row, campaign_id: id })));
        await supabase.from('campaign_scenes').insert({ campaign_id: id, scene_id: opening.id, act_id: opening.actId, scene_number: savepoint.sceneNumber, content: opening });
        const { data: images } = await supabase.from('campaign_scene_images').select('scene_id, scene_number, status, layout, prompt, image_url, storage_path, model, error, version, created_by').eq('campaign_id', source.id).lte('scene_number', savepoint.sceneNumber);
        if (images?.length) await supabase.from('campaign_scene_images').insert(images.map((row: any) => ({ ...row, campaign_id: id })));
      } else {
        await supabase.from('campaign_scenes').insert({ campaign_id: id, scene_id: opening.id, act_id: opening.actId, scene_number: 1, content: opening });
        const { data: openingImages } = await supabase.from('campaign_scene_images').select('scene_id, scene_number, status, layout, prompt, image_url, storage_path, model, error, version, created_by').eq('campaign_id', source.id).eq('scene_number', 1);
        if (openingImages?.length) await supabase.from('campaign_scene_images').insert(openingImages.map((row: any) => ({ ...row, campaign_id: id })));
      }
      const systems = normalizeSystems(state.systems || createInitialSystems(source.bible, opening, snapshots));
      const version = await commitWorldEvent({ campaignId: id, expectedVersion: 0, eventType: savepoint ? 'timeline_forked' : 'timeline_restarted', sceneId: opening.id, actorId: snapshots[0].id, summary: savepoint ? `Открыта временная линия из сохранения «${savepoint.label}».` : 'История начата заново в новой временной линии.', patch: bootstrapPatch(systems), systems, campaignState: { ...state, systems }, currentScene: opening });
      runtime = { ...runtime, state: { ...state, systems, version } };
      const ownSnapshot = replayParticipants.find(row => row.user_session_id === userSessionId)?.character_snapshot || snapshots[0];
      setSelectedCharacter(ownSnapshot); setCampaignCharacters(snapshots); setCampaign(runtime); setMode(runtime.mode); setScreen('story'); void loadCampaigns();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось открыть новую временную линию');
    } finally { setLoading(false); }
  }

  const isPlaceholder = supabaseUrl.includes('your-project-id') || supabaseAnonKey === 'your-anon-key';
  if (!isSupabaseConfigured || isPlaceholder) return <ConfigurationScreen/>;
  if (screen === 'characters') return <Suspense fallback={<ScreenLoader/>}><CharacterStudio onSelect={character => void handleCharacterSelected(character)} onInventory={character => { setSelectedCharacter(character); setInventoryReturn('characters'); setScreen('inventory'); }} onBack={() => setScreen(flow === 'join' ? 'join' : 'home')} title={flow === 'library' ? 'Библиотека героев' : 'Кто отправится в путь?'}/></Suspense>;
  if (screen === 'inventory' && selectedCharacter) return <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-amber-400"><Loader2 className="animate-spin"/></div>}><InventoryPanel character={selectedCharacter} onSave={updateCharacter} onClose={() => setScreen(inventoryReturn)}/></Suspense>;
  if (screen === 'chronicles') return <Suspense fallback={<ScreenLoader/>}><ChronicleLibrary campaigns={campaigns} onBack={() => setScreen('home')} onContinue={runtime => { setCampaign(runtime); setMode(runtime.mode); void openStartedCampaign(runtime.id); }} onReplay={(runtime, point) => void replayCampaign(runtime, point)} replaying={loading} error={error}/></Suspense>;
  if (screen === 'setup' && selectedCharacter) return <Suspense fallback={<ScreenLoader/>}><CampaignSetup mode={mode} character={selectedCharacter} onBack={() => setScreen('characters')} onStart={handleSetupStart} loading={loading} error={error}/></Suspense>;
  if (screen === 'waiting' && draftCampaignId) return <Suspense fallback={<ScreenLoader/>}><PartyWaitingRoom campaignId={draftCampaignId} currentUserId={userSessionId} onBack={() => setScreen('home')} onStartCampaign={() => void startPreparedParty()} starting={loading} externalError={error} onCampaignStarted={() => void openStartedCampaign(draftCampaignId)}/></Suspense>;
  if (screen === 'story' && campaign && selectedCharacter) return <Suspense fallback={<ScreenLoader/>}><StoryReader campaign={campaign} characters={campaignCharacters.length ? campaignCharacters : [selectedCharacter]} activeCharacter={selectedCharacter} currentUserId={userSessionId} onUpdate={updateCampaign} onRemoteUpdate={setCampaign} onPartyCharactersUpdate={setCampaignCharacters} onCharacterUpdate={updateCharacter} onLeave={() => { setCampaign(null); setScreen('home'); void loadCampaigns(); }}/></Suspense>;
  if (screen === 'join') return <JoinScreen code={joinCode} setCode={setJoinCode} onBack={() => setScreen('home')} onJoin={() => void findCampaignToJoin()} loading={loading} error={error}/>;
  return <HomeScreen campaigns={campaigns} onSolo={() => startFlow('solo')} onParty={() => startFlow('party')} onJoin={() => { setError(''); setScreen('join'); }} onLibrary={() => { setFlow('library'); setScreen('characters'); }} onChronicles={() => { setError(''); setScreen('chronicles'); }} onContinue={runtime => { setCampaign(runtime); setMode(runtime.mode); void openStartedCampaign(runtime.id); }} error={error}/>;
}

function ScreenLoader() {
  return <div className="home-shell min-h-screen flex items-center justify-center text-amber-400"><HomeAtmosphere/><div className="home-content flex flex-col items-center gap-3"><Loader2 className="animate-spin"/><span className="text-xs tracking-[.18em] uppercase text-zinc-600">Открываем хронику</span></div></div>;
}

function JoinScreen({ code, setCode, onBack, onJoin, loading, error }: { code: string; setCode: (code: string) => void; onBack: () => void; onJoin: () => void; loading: boolean; error: string }) { return <div className="home-shell min-h-screen text-zinc-100 flex items-center justify-center p-4"><HomeAtmosphere/><div className="entry-card home-content max-w-md w-full"><button onClick={onBack} className="entry-back">← На главный экран</button><div className="entry-emblem"><Users size={24}/></div><div className="text-center"><p className="entry-kicker">Совместная игра</p><h1 className="entry-title">Найти свою партию</h1><p className="entry-copy">Введи код, который показан создателю кампании.</p></div><input aria-label="Код кампании" autoFocus value={code} onChange={event => setCode(event.target.value.toUpperCase())} onKeyDown={event => event.key === 'Enter' && onJoin()} maxLength={8} placeholder="ABC123" className="entry-code"/>{error && <p className="text-sm text-red-400 text-center">{error}</p>}<button disabled={loading || !code.trim()} onClick={onJoin} className="entry-submit">{loading ? <Loader2 className="animate-spin"/> : <ChevronRight/>}Продолжить</button></div></div>; }
function ConfigurationScreen() { return <div className="home-shell min-h-screen text-zinc-100 flex items-center justify-center p-4"><HomeAtmosphere/><div className="entry-card home-content max-w-md w-full text-center"><div className="entry-emblem entry-emblem-warning"><AlertTriangle size={25}/></div><p className="entry-kicker">Подготовка мира</p><h1 className="entry-title">Нужна конфигурация</h1><p className="entry-copy">Укажите <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_ANON_KEY</code>, чтобы открыть хронику.</p></div></div>; }

function createCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function migrationMessage(message: string) { return /campaigns|campaign_participants|schema cache|relation/i.test(message) ? `Новая структура БД ещё не применена. Выполните migration_interactive_rpg_v1.sql. Техническая ошибка: ${message}` : message; }
function timelineMigrationMessage(message: string) { return /campaign_stories|campaign_savepoints|story_id|timeline_number|schema cache|relation/i.test(message) ? `Система историй ещё не установлена. Выполните migration_story_timelines_v2.sql. Техническая ошибка: ${message}` : message; }
function runtimeToRow(runtime: CampaignRuntime) { return { id: runtime.id, story_id: runtime.storyId || runtime.id, timeline_number: runtime.timelineNumber || 1, parent_campaign_id: runtime.parentCampaignId || null, ending_id: runtime.endingId || null, ending_title: runtime.endingTitle || null, finished_at: runtime.finishedAt || null, mode: runtime.mode, status: runtime.status, host_user_id: runtime.hostUserId, title: runtime.bible.title, preferences: runtime.preferences, bible: runtime.bible, state: runtime.state, current_scene: runtime.currentScene, updated_at: new Date().toISOString() }; }
function rowToRuntime(row: any): CampaignRuntime {
  const systems = normalizeSystems(row.state?.systems || (row.bible && row.current_scene ? createInitialSystems(row.bible, row.current_scene, []) : undefined));
  return { id: row.id, storyId: row.story_id || row.id, timelineNumber: row.timeline_number || 1, parentCampaignId: row.parent_campaign_id || undefined, endingId: row.ending_id || undefined, endingTitle: row.ending_title || undefined, finishedAt: row.finished_at || undefined, mode: row.mode, status: row.status, hostUserId: row.host_user_id, preferences: row.preferences, bible: row.bible, state: { ...row.state, version: row.state?.version ?? row.state_version ?? 0, systems }, currentScene: row.current_scene };
}
