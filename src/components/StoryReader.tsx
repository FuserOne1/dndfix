import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Backpack, BookOpen, BookmarkPlus, Check, ChevronDown, Compass, Loader2, Lock, ScrollText, Shield, ShoppingBag, Users } from 'lucide-react';
import { BattleResult, BattleStartData, Character, CharacterStats } from '../types';
import { supabase } from '../lib/supabase';
import { generateNextScene } from '../game/campaign-generator';
import { CampaignRuntime, ChoiceResolution, StoryChoice } from '../game/types';
import { isChoiceAvailable, previewChoiceCheck, resolveChoice } from '../game/rules';
import { addInventoryItem, consumeItemByName, createStoryItem, equippedItemNames, inventoryHasItem, inventoryItemNames, itemEffectsMap, itemNamesMatch, normalizeInventory, passiveInventoryBonuses, quickItemNames } from '../game/inventory';
import { findItemDefinition } from '../game/items';
import { applyExperience, experienceForScene } from '../game/progression';
import { enterScene, normalizeSceneType, recordCompletedScene } from '../game/scene-director';
import { applyWorldPatch, currentLocation, mergeWorldPatches, sanitizeWorldPatch, sceneEntryPatch, worldPatchForChoice } from '../game/world-state';
import { commitWorldEvent } from '../game/world-state-store';
import { getScenePresentation } from '../game/scene-presentation';
import { identifyEnding, savepointLabel, storyIdOf } from '../game/timelines';
import SceneIllustration from './SceneIllustration';
import DiceCheckCard from './DiceCheckCard';
import StoryText from './StoryText';
import SceneAtmosphere from './SceneAtmosphere';
import CharacterMedallion from './CharacterMedallion';
const BattleModal = lazy(() => import('./BattleModal'));
const InventoryPanel = lazy(() => import('./InventoryPanel'));
const SceneArchive = lazy(() => import('./SceneArchive'));
const AdventureJournal = lazy(() => import('./AdventureJournal'));

interface StoryReaderProps {
  campaign: CampaignRuntime;
  characters: Character[];
  activeCharacter: Character;
  currentUserId: string;
  onUpdate: (campaign: CampaignRuntime) => void | Promise<void>;
  onRemoteUpdate?: (campaign: CampaignRuntime) => void;
  onPartyCharactersUpdate?: (characters: Character[]) => void;
  onCharacterUpdate: (character: Character) => void | Promise<void>;
  onLeave: () => void;
}

interface Vote { user_session_id: string; choice_id: string; }

export default function StoryReader({ campaign, characters, activeCharacter, currentUserId, onUpdate, onRemoteUpdate, onPartyCharactersUpdate, onCharacterUpdate, onLeave }: StoryReaderProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState('');
  const [votes, setVotes] = useState<Vote[]>([]);
  const [resolving, setResolving] = useState(false);
  const [lastResolution, setLastResolution] = useState<ChoiceResolution | null>(null);
  const [rewardNotice, setRewardNotice] = useState<{ characterName: string; items: string[]; xp: number; levelUp?: number } | null>(null);
  const [error, setError] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [inventoryInitialTab, setInventoryInitialTab] = useState<'inventory' | 'trade'>('inventory');
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);
  const [checkpointNotice, setCheckpointNotice] = useState('');
  const [pendingBattle, setPendingBattle] = useState<{ choice: StoryChoice; resolution: ChoiceResolution; data: BattleStartData } | null>(null);
  const migratedLegacyInventoryRef = useRef('');
  const isHost = campaign.hostUserId === currentUserId;
  const scene = campaign.currentScene;
  const isIncapsipated = activeCharacter.hp_current <= 0;
  const presentation = useMemo(() => getScenePresentation(scene), [scene]);
  const availableStoryItems = useMemo(() => [...new Set([...campaign.state.inventory, ...inventoryItemNames(normalizeInventory(activeCharacter))])], [activeCharacter, campaign.state.inventory]);
  const canTradeHere = Boolean(scene.services?.trade || normalizeSceneType(scene.type) === 'trade');
  const personalHook = campaign.bible.characterHooks.find(hook => hook.characterName === activeCharacter.name)?.hook;

  function openInventory(tab: 'inventory' | 'trade' = 'inventory') {
    setInventoryInitialTab(tab);
    setShowInventory(true);
  }

  const loadVotes = useCallback(async () => {
    if (campaign.mode !== 'party') return;
    const { data, error: voteError } = await supabase.from('campaign_votes').select('user_session_id, choice_id').eq('campaign_id', campaign.id).eq('scene_id', scene.id);
    if (!voteError) setVotes((data || []) as Vote[]);
  }, [campaign.id, campaign.mode, scene.id]);

  useEffect(() => {
    setSelectedChoiceId(''); setLastResolution(null); setError('');
    void loadVotes();
    if (campaign.mode !== 'party') return;
    const channel = supabase.channel(`campaign-votes:${campaign.id}:${scene.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_votes', filter: `campaign_id=eq.${campaign.id}` }, () => void loadVotes()).subscribe();
    const poll = window.setInterval(() => void loadVotes(), 2_500);
    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [campaign.id, campaign.mode, loadVotes, scene.id]);

  useEffect(() => {
    if (campaign.mode !== 'party' || isHost || !onRemoteUpdate) return;
    let applying = false;
    const applyRemoteRow = (row: any) => {
      if (!row?.current_scene) return;
      const sceneChanged = row.current_scene.id !== campaign.currentScene.id;
      const statusChanged = row.status && row.status !== campaign.status;
      if (!sceneChanged && !statusChanged) return;
      onRemoteUpdate({ ...campaign, status: row.status || campaign.status, preferences: row.preferences || campaign.preferences, bible: row.bible || campaign.bible, state: row.state || campaign.state, currentScene: row.current_scene });
    };
    const pollCampaign = async () => {
      if (applying) return;
      applying = true;
      const { data } = await supabase.from('campaigns').select('status, preferences, bible, state, current_scene').eq('id', campaign.id).maybeSingle();
      applying = false;
      applyRemoteRow(data);
    };
    const channel = supabase.channel(`campaign-state:${campaign.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaign.id}` }, payload => applyRemoteRow(payload.new)).subscribe();
    const poll = window.setInterval(() => void pollCampaign(), 2_500);
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void pollCampaign(); };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    void pollCampaign();
    return () => { window.clearInterval(poll); document.removeEventListener('visibilitychange', refreshWhenVisible); void supabase.removeChannel(channel); };
  }, [campaign, isHost, onRemoteUpdate]);

  useEffect(() => {
    if (campaign.mode !== 'party' || !onPartyCharactersUpdate) return;
    const loadPartyCharacters = async () => {
      const { data } = await supabase.from('campaign_participants').select('character_snapshot').eq('campaign_id', campaign.id).order('joined_at');
      if (data?.length) onPartyCharactersUpdate(data.map((row: { character_snapshot: Character }) => row.character_snapshot));
    };
    const channel = supabase.channel(`campaign-party:${campaign.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_participants', filter: `campaign_id=eq.${campaign.id}` }, () => void loadPartyCharacters()).subscribe();
    const poll = window.setInterval(() => void loadPartyCharacters(), 5_000);
    void loadPartyCharacters();
    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [campaign.id, campaign.mode, onPartyCharactersUpdate]);

  useEffect(() => {
    if (campaign.mode === 'party' && !isHost && campaign.status === 'finished') onLeave();
  }, [campaign.mode, campaign.status, isHost, onLeave]);

  useEffect(() => {
    if (campaign.mode === 'party' && !isHost) return;
    const physicalItems = campaign.state.inventory.filter(item => findItemDefinition(item));
    if (!physicalItems.length) return;
    const migrationKey = `${campaign.id}:${activeCharacter.id}:${physicalItems.join('|')}`;
    if (migratedLegacyInventoryRef.current === migrationKey) return;
    migratedLegacyInventoryRef.current = migrationKey;
    void (async () => {
      try {
        let inventory = normalizeInventory(activeCharacter);
        for (const item of physicalItems) inventory = addInventoryItem(inventory, createStoryItem(item), true).inventory;
        await onCharacterUpdate({ ...activeCharacter, inventory_data: inventory, equipment: equippedItemNames(inventory) });
        await onUpdate({ ...campaign, state: { ...campaign.state, inventory: campaign.state.inventory.filter(item => !physicalItems.some(physical => itemNamesMatch(physical, item))) } });
        setRewardNotice({ characterName: activeCharacter.name, items: physicalItems, xp: 0 });
      } catch {
        migratedLegacyInventoryRef.current = '';
      }
    })();
  // Одноразовый мост для физических наград, сохранённых старой версией в state.inventory.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, activeCharacter.id]);

  const availableChoices = useMemo(() => {
    const sceneChoices = scene.choices.map(choice => ({ choice, availability: isChoiceAvailable(choice, activeCharacter, campaign.state.flags, availableStoryItems) }));
    if (campaign.mode !== 'party') return sceneChoices;
    const downed = characters.filter(c => c.hp_current <= 0 && c.id !== activeCharacter.id);
    for (const ally of downed) {
      const helpChoice: StoryChoice = { id: `help-${ally.id}`, label: `Помочь ${ally.name}`, description: `Стабилизировать ${ally.name} и вернуть его в строй.`, intent: `помочь ${ally.name}`, consequences: { hpChange: Math.max(1, Math.floor(ally.hp_max * 0.3)), successFlags: [`helped-${ally.id}`] } };
      sceneChoices.push({ choice: helpChoice, availability: { available: true } });
    }
    return sceneChoices;
  }, [activeCharacter, availableStoryItems, campaign.mode, campaign.state.flags, characters, scene.choices]);

  const isHelpChoice = (id: string) => id.startsWith('help-');
  const helpTargetId = (id: string) => id.replace('help-', '');

  async function selectChoice(choice: StoryChoice) {
    const availability = isChoiceAvailable(choice, activeCharacter, campaign.state.flags, availableStoryItems);
    if (!availability.available || resolving) return;
    setSelectedChoiceId(choice.id);
    if (campaign.mode === 'solo') return;
    const { error: voteError } = await supabase.from('campaign_votes').upsert({ campaign_id: campaign.id, scene_id: scene.id, user_session_id: currentUserId, choice_id: choice.id }, { onConflict: 'campaign_id,scene_id,user_session_id' });
    if (voteError) {
      // До применения миграции голос остаётся локальным — соло и локальная партия продолжают работать.
      setVotes(previous => [...previous.filter(vote => vote.user_session_id !== currentUserId), { user_session_id: currentUserId, choice_id: choice.id }]);
      setError('Голос сохранён локально. Для синхронизации примените новую SQL-миграцию.');
    } else await loadVotes();
  }

  function winningChoice(): StoryChoice | undefined {
    if (campaign.mode === 'solo') return scene.choices.find(choice => choice.id === selectedChoiceId) || (isHelpChoice(selectedChoiceId) ? availableChoices.find(item => item.choice.id === selectedChoiceId)?.choice : undefined);
    const counts = votes.reduce<Record<string, number>>((result, vote) => ({ ...result, [vote.choice_id]: (result[vote.choice_id] || 0) + 1 }), {});
    const allIds = [...scene.choices.map(c => c.id), ...availableChoices.filter(item => isHelpChoice(item.choice.id)).map(item => item.choice.id)];
    const winner = allIds.filter(id => counts[id]).sort((left, right) => (counts[right] || 0) - (counts[left] || 0))[0];
    if (winner) return availableChoices.find(item => item.choice.id === winner)?.choice || scene.choices.find(c => c.id === winner);
    return scene.choices.find(choice => choice.id === selectedChoiceId);
  }

  async function confirmChoice() {
    const choice = winningChoice();
    if (!choice || resolving) return;
    setResolving(true); setError(''); setRewardNotice(null);
    try {
      await persistSavepoint('branch');
      if (isHelpChoice(choice.id)) {
        const targetId = helpTargetId(choice.id);
        const target = characters.find(c => c.id === targetId);
        if (!target) { setError('Герой не найден'); setResolving(false); return; }
        const healAmount = choice.consequences.hpChange || Math.max(1, Math.floor(target.hp_max * 0.3));
        const healed: Character = { ...target, hp_current: Math.min(target.hp_max, target.hp_current + healAmount) };
        await onCharacterUpdate(healed);
        const nextCharacters = characters.map(c => c.id === target.id ? healed : c);
        setRewardNotice({ characterName: target.name, items: [], xp: 0 });
        setLastResolution({ success: true, summary: `${activeCharacter.name} стабилизировал ${target.name}.`, hpChange: 0, goldChange: 0, lostItems: [], gainedItems: [], roll: null, successFlags: [`helped-${target.id}`], failureFlags: [] });
        const nextState = { ...campaign.state, flags: [...new Set([...campaign.state.flags, `helped-${target.id}`])], completedSceneIds: [...campaign.state.completedSceneIds, scene.id], sceneNumber: campaign.state.sceneNumber + 1, checkFailureStreak: 0, director: recordCompletedScene(campaign.state.director, scene, nextCharacters) };
        const nextScene = await generateNextScene({ bible: campaign.bible, previousScene: scene, resolution: { success: true, summary: `${activeCharacter.name} стабилизировал ${target.name}.`, hpChange: 0, goldChange: 0, lostItems: [], gainedItems: [], roll: null }, state: nextState, characters: nextCharacters, preferences: campaign.preferences });
        const systems = applyWorldPatch(nextState.systems, {}, nextScene.id, nextState.sceneNumber);
        const committedState = { ...nextState, systems, currentSceneId: nextScene.id, currentActId: nextScene.actId, director: enterScene(nextState.director, nextScene) };
        const version = await commitWorldEvent({ campaignId: campaign.id, expectedVersion: campaign.state.version || 0, eventType: 'choice_resolved', sceneId: scene.id, choiceId: choice.id, actorId: activeCharacter.id, summary: `Стабилизация ${target.name}.`, patch: {}, systems, campaignState: committedState, currentScene: nextScene });
        const updated: CampaignRuntime = { ...campaign, state: { ...committedState, version }, currentScene: nextScene };
        await onUpdate(updated);
        if (campaign.mode === 'party') await supabase.from('campaign_votes').delete().eq('campaign_id', campaign.id).eq('scene_id', scene.id);
        return;
      }
      const actor = chooseActor(choice, characters, activeCharacter, campaign.preferences.difficulty, campaign.state.checkFailureStreak);
      const resolution = resolveChoice(choice, actor, { difficulty: campaign.preferences.difficulty, failureStreak: campaign.state.checkFailureStreak });
      setLastResolution(resolution);
      if (choice.consequences.startsBattle && !resolution.success) {
        setPendingBattle({ choice, resolution, data: choice.consequences.battle || createDefaultBattle(campaign.state.sceneNumber) });
        setResolving(false);
        return;
      }
      await continueStory(choice, resolution, actor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось продолжить историю');
    } finally { setResolving(false); }
  }

  async function continueStory(choice: StoryChoice, resolution: ChoiceResolution, actor: Character, baseCharacter: Character = actor, experienceOverride?: number) {
      const successFlags = resolution.success ? choice.consequences.successFlags || [] : choice.consequences.failureFlags || [];
      const nextInventory = campaign.state.inventory.filter(item => !resolution.lostItems.some(lost => itemNamesMatch(item, lost)));
      let personalInventory = normalizeInventory(baseCharacter);
      const nextHp = Math.max(0, Math.min(baseCharacter.hp_max, baseCharacter.hp_current + resolution.hpChange));
      const nextGold = Math.max(0, (baseCharacter.gold || 0) + resolution.goldChange);
      for (const lost of resolution.lostItems) {
        if (inventoryHasItem(personalInventory, lost)) {
          personalInventory = consumeItemByName(personalInventory, lost);
        }
      }
      for (const item of resolution.gainedItems) {
        // Сюжетная награда никогда не пропадает из-за несовпавшего названия или
        // полного рюкзака: неизвестные предметы сохраняются как уникальные сюжетные.
        personalInventory = addInventoryItem(personalInventory, createStoryItem(item), true).inventory;
      }
      const xpGained = experienceOverride ?? experienceForScene(scene, resolution);
      const progression = applyExperience({ ...baseCharacter, hp_current: nextHp, gold: nextGold, inventory_data: personalInventory, equipment: equippedItemNames(personalInventory) }, xpGained);
      const resolvedWithProgression: ChoiceResolution = { ...resolution, xpGained: progression.xpGained, levelBefore: progression.levelBefore, levelAfter: progression.levelAfter };
      await onCharacterUpdate(progression.character);
      let nextCharacters = characters.map(character => character.id === progression.character.id ? progression.character : character);
      if (campaign.mode === 'party' && xpGained > 0) {
        for (const member of nextCharacters) {
          if (member.id !== progression.character.id) {
            const memberProgression = applyExperience(member, xpGained);
            nextCharacters = nextCharacters.map(c => c.id === member.id ? memberProgression.character : c);
            if (member.id === activeCharacter.id) await onCharacterUpdate(memberProgression.character);
          }
        }
      }
      setRewardNotice({ characterName: progression.character.name, items: resolution.gainedItems, xp: progression.xpGained, levelUp: progression.levelAfter > progression.levelBefore ? progression.levelAfter : undefined });
      const choicePatch = sanitizeWorldPatch(worldPatchForChoice(choice, resolution.success), { bible: campaign.bible, characters: nextCharacters, systems: campaign.state.systems, scene });
      const nextState = {
        ...campaign.state,
        flags: [...new Set([...campaign.state.flags, ...successFlags])],
        inventory: nextInventory,
        completedSceneIds: [...campaign.state.completedSceneIds, scene.id],
        sceneNumber: campaign.state.sceneNumber + 1,
        checkFailureStreak: choice.check ? (resolution.success ? 0 : (campaign.state.checkFailureStreak || 0) + 1) : campaign.state.checkFailureStreak || 0,
        director: recordCompletedScene(campaign.state.director, scene, nextCharacters),
        systems: applyWorldPatch(campaign.state.systems, choicePatch, scene.id, campaign.state.sceneNumber),
      };
      const { error: archiveError } = await supabase.from('campaign_scenes').upsert({ campaign_id: campaign.id, scene_id: scene.id, act_id: scene.actId, scene_number: campaign.state.sceneNumber, content: scene, resolution: resolvedWithProgression }, { onConflict: 'campaign_id,scene_id' });
      if (archiveError) console.warn('Scene resolution was not saved to the archive:', archiveError);
      const nextScene = await generateNextScene({ bible: campaign.bible, previousScene: scene, resolution: resolvedWithProgression, state: nextState, characters: nextCharacters, preferences: campaign.preferences });
      const locationPatch = sceneEntryPatch(nextScene, currentLocation(campaign.state.systems, scene));
      const systemPatch = mergeWorldPatches(choicePatch, locationPatch);
      const systems = applyWorldPatch(nextState.systems, locationPatch, nextScene.id, nextState.sceneNumber);
      const committedState = { ...nextState, systems, currentSceneId: nextScene.id, currentActId: nextScene.actId, director: enterScene(nextState.director, nextScene) };
      const version = await commitWorldEvent({ campaignId: campaign.id, expectedVersion: campaign.state.version || 0, eventType: 'choice_resolved', sceneId: scene.id, choiceId: choice.id, actorId: actor.id, summary: resolvedWithProgression.summary || choice.label, patch: systemPatch, systems, campaignState: committedState, currentScene: nextScene });
      const updated: CampaignRuntime = { ...campaign, state: { ...committedState, version }, currentScene: nextScene };
      await onUpdate(updated);
      if (campaign.mode === 'party') await supabase.from('campaign_votes').delete().eq('campaign_id', campaign.id).eq('scene_id', scene.id);
  }

  async function finishBattle(result: BattleResult) {
    if (!pendingBattle) return;
    let inventory = normalizeInventory(activeCharacter);
    for (const consumed of result.itemsConsumed) inventory = consumeItemByName(inventory, consumed);
    const battleCharacter: Character = { ...activeCharacter, hp_current: result.finalHp, equipment: equippedItemNames(inventory), inventory_data: inventory };
    const resolution: ChoiceResolution = {
      ...pendingBattle.resolution,
      success: result.victory,
      summary: result.victory ? `Бой выигран. Побеждены: ${result.enemiesDefeated.join(', ')}.` : 'Герой потерпел поражение в бою.',
      gainedItems: [...new Set([...pendingBattle.resolution.gainedItems, ...result.itemsGained])],
      hpChange: 0,
    };
    const choice = pendingBattle.choice;
    setPendingBattle(null);
    setResolving(true);
    try { await continueStory(choice, resolution, activeCharacter, battleCharacter, result.xpGained); }
    finally { setResolving(false); }
  }

  async function finishCampaign() {
    if (campaign.mode === 'party' && !isHost) return;
    setResolving(true); setError('');
    try {
      const ending = identifyEnding(campaign.bible, scene);
      await persistSavepoint('ending', `Финал · ${ending.title}`);
      await onUpdate({ ...campaign, status: 'finished', endingId: ending.id, endingTitle: ending.title, finishedAt: new Date().toISOString() });
      onLeave();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось завершить кампанию');
    } finally { setResolving(false); }
  }

  async function persistSavepoint(kind: 'branch' | 'manual' | 'ending', label = savepointLabel(campaign)) {
    if (campaign.mode === 'party' && !isHost) return;
    if (kind !== 'manual') {
      const { data: existing, error: lookupError } = await supabase.from('campaign_savepoints').select('id').eq('campaign_id', campaign.id).eq('scene_id', scene.id).eq('kind', kind).maybeSingle();
      if (lookupError) throw new Error(savepointError(lookupError.message));
      if (existing) return;
    }
    const { error: saveError } = await supabase.from('campaign_savepoints').insert({
      story_id: storyIdOf(campaign), campaign_id: campaign.id, created_by: currentUserId, label, kind,
      scene_id: scene.id, scene_number: campaign.state.sceneNumber, state: campaign.state,
      current_scene: scene, character_snapshots: characters,
    });
    if (saveError) throw new Error(savepointError(saveError.message));
  }

  async function createManualSavepoint() {
    setSavingCheckpoint(true); setCheckpointNotice(''); setError('');
    try {
      await persistSavepoint('manual', `Сохранение · сцена ${campaign.state.sceneNumber}`);
      setCheckpointNotice('Сохранение добавлено в «Мои хроники»');
      window.setTimeout(() => setCheckpointNotice(''), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить хронику');
    } finally { setSavingCheckpoint(false); }
  }

  return <div className={`scene-shell scene-theme-${presentation.palette} min-h-screen text-zinc-100`} data-scene={scene.id}>
    <SceneAtmosphere presentation={presentation}/>
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-3 sm:px-4 py-3"><div className="max-w-6xl mx-auto flex justify-between items-center gap-2"><div className="flex items-center gap-2 sm:gap-3 min-w-0"><button onClick={onLeave} className="shrink-0 p-2.5 rounded-xl border border-zinc-800"><ArrowLeft className="w-4 h-4"/></button><div className="min-w-0"><p className="text-[10px] sm:text-xs text-amber-500 truncate">{campaign.bible.acts.find(act => act.id === scene.actId)?.title || 'Кампания'}</p><h1 className="font-bold text-sm sm:text-base truncate">{campaign.bible.title}</h1></div></div><div className="shrink-0 flex items-center gap-2"><span className="hidden sm:inline text-xs text-zinc-500">Сцена {campaign.state.sceneNumber}</span>{(campaign.mode === 'solo' || isHost) && <button disabled={savingCheckpoint} onClick={() => void createManualSavepoint()} className="p-2.5 rounded-xl border border-zinc-800 disabled:opacity-40" aria-label="Создать сохранение"><BookmarkPlus className={`w-4 h-4 ${savingCheckpoint ? 'animate-pulse' : ''}`}/></button>}<button onClick={() => setShowJournal(true)} className="p-2.5 rounded-xl border border-zinc-800" aria-label="Открыть журнал приключения"><Compass className="w-4 h-4"/></button><button onClick={() => openInventory()} className="p-2.5 rounded-xl border border-zinc-800" aria-label="Открыть инвентарь"><Backpack className="w-4 h-4"/></button><button onClick={() => setShowArchive(true)} className="p-2.5 rounded-xl border border-zinc-800" aria-label="Открыть хронику"><ScrollText className="w-4 h-4"/></button></div></div>{checkpointNotice && <div className="absolute right-3 top-full mt-2 rounded-lg border border-emerald-500/20 bg-zinc-950/95 px-3 py-2 text-xs text-emerald-300 shadow-xl">{checkpointNotice}</div>}</header>
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_260px] gap-6 p-4 sm:p-8">
      <main className="max-w-3xl w-full mx-auto space-y-7">
        <div className="scene-hero-ribbon"><CharacterMedallion character={activeCharacter}/><div className="scene-hero-stats"><span className={isIncapsipated ? 'text-red-400 font-bold' : ''}>{isIncapsipated ? '☠' : '♥'} {activeCharacter.hp_current}/{activeCharacter.hp_max}</span><span>ур. {activeCharacter.level}</span><span>{activeCharacter.xp} XP</span></div></div>
        <section key={scene.id} className="story-page scene-enter"><div className="scene-meta"><span className="scene-type-glyph">{presentation.glyph}</span><span>{presentation.label}</span><i/><BookOpen className="w-3.5 h-3.5"/><span>{scene.location}</span><b>опасность {presentation.tension}/5</b></div><h2 className="story-title">{scene.title}</h2><div className="story-ornament"><span>{presentation.glyph}</span></div><SceneIllustration campaignId={campaign.id} scene={scene} sceneNumber={campaign.state.sceneNumber} bible={campaign.bible} preferences={campaign.preferences} characters={characters} currentUserId={currentUserId} canGenerate={isHost} autoGenerate={isHost}/><div className="story-body">{scene.body.map((paragraph, index) => <div key={index} className="story-paragraph-reveal" style={{ animationDelay: `${Math.min(index * 75, 450)}ms` }}><StoryText first={index === 0}>{paragraph}</StoryText></div>)}</div></section>
        {canTradeHere && <section className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="flex gap-3"><ShoppingBag className="w-5 h-5 text-amber-400 shrink-0"/><div><strong className="text-amber-200">Здесь можно торговать</strong><p className="text-xs text-zinc-400 mt-1">Осмотрите товары, продайте добычу или просто узнайте, сколько она стоит.</p></div></div><button onClick={() => openInventory('trade')} className="px-4 py-3 rounded-xl bg-amber-500 text-zinc-950 text-sm font-black shrink-0">Открыть торговлю</button></section>}
        {lastResolution && <DiceCheckCard resolution={lastResolution}/>}
        {rewardNotice && (rewardNotice.items.length > 0 || rewardNotice.xp > 0) && <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm"><strong className="text-emerald-300">Награды сохранены · {rewardNotice.characterName}</strong><div className="mt-2 flex flex-wrap gap-2">{rewardNotice.items.map((item, index) => <span key={`${item}-${index}`} className="rounded-lg bg-zinc-950/50 px-2 py-1">+ {item}</span>)}{rewardNotice.xp > 0 && <span className="rounded-lg bg-zinc-950/50 px-2 py-1">+{rewardNotice.xp} опыта</span>}{rewardNotice.levelUp && <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-amber-300">Новый уровень: {rewardNotice.levelUp}</span>}</div></section>}
        {error && <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">{error}</div>}
        {isIncapsipated && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-center"><p className="text-red-300 font-bold text-lg">Без сознания</p><p className="text-sm text-zinc-400 mt-2">{activeCharacter.name} потерял сознание. Нужна медицинская помощь или магическое исцеление, чтобы вернуться в бой.</p><p className="text-xs text-zinc-600 mt-3">Используйте зелье или свиток лечения через инвентарь, чтобы восстановить HP.</p></div>}
        {normalizeSceneType(scene.type) === 'ending' ? <section className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10"><p className="text-sm text-amber-200">История завершена. Этот финал сохранится в хронике кампании.</p><button disabled={resolving || (campaign.mode === 'party' && !isHost)} onClick={() => void finishCampaign()} className="w-full mt-4 p-4 rounded-2xl bg-amber-500 text-zinc-950 font-black disabled:opacity-40">{campaign.mode === 'party' && !isHost ? 'Ведущий завершает кампанию' : 'Закрыть хронику'}</button></section> : <section className="space-y-3"><div className="flex items-center justify-between"><h3 className="story-choice-heading">Что вы сделаете?</h3>{campaign.mode === 'party' && <span className="text-xs text-zinc-500 flex items-center gap-1"><Users className="w-3.5 h-3.5"/>{votes.length} голосов</span>}</div>{availableChoices.map(({ choice, availability }, index) => { const voteCount = votes.filter(vote => vote.choice_id === choice.id).length; const selected = selectedChoiceId === choice.id || votes.some(vote => vote.user_session_id === currentUserId && vote.choice_id === choice.id); const actor = chooseActor(choice, characters, activeCharacter, campaign.preferences.difficulty, campaign.state.checkFailureStreak); const check = previewChoiceCheck(choice, actor, { difficulty: campaign.preferences.difficulty, failureStreak: campaign.state.checkFailureStreak }); return <button key={choice.id} disabled={!availability.available || resolving} onClick={() => void selectChoice(choice)} className={`story-choice ${selected ? 'story-choice-selected' : availability.available ? '' : 'story-choice-locked'}`}><div className="flex gap-3"><span className="story-choice-number">{availability.available ? index + 1 : <Lock className="w-3 h-3"/>}</span><div className="flex-1 min-w-0"><div className="flex justify-between gap-2"><strong>{choice.label}</strong>{voteCount > 0 && <span className="text-xs text-amber-400">{voteCount}</span>}</div>{choice.description && <p className="text-xs text-zinc-500 mt-1">{choice.description}</p>}{check && <div className="check-preview"><span>{check.skill || check.attributeLabel}</span><span>СЛ {check.difficulty}</span><strong>{check.successChance}%</strong>{check.advantageReason && <span className="check-advantage">◆ преимущество</span>}{campaign.mode === 'party' && <span>{actor.name}</span>}</div>}{!availability.available && <p className="text-[10px] text-red-400 mt-1">{availability.reason}</p>}</div></div></button>; })}
          <button disabled={resolving || !winningChoice() || isIncapsipated || (campaign.mode === 'party' && !isHost)} onClick={() => void confirmChoice()} className="w-full p-4 rounded-2xl bg-amber-500 text-zinc-950 font-black flex justify-center items-center gap-2 disabled:opacity-30">{resolving ? <Loader2 className="animate-spin"/> : <Check/>}{resolving ? 'Пишем следующую сцену…' : isIncapsipated ? 'Нужна помощь…' : campaign.mode === 'party' ? isHost ? 'Подтвердить выбор группы' : 'Ожидаем ведущего' : 'Сделать выбор'}</button>
        </section>}
      </main>
      <aside className="space-y-3"><button onClick={() => setShowJournal(true)} className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left hover:border-amber-400"><p className="text-xs uppercase text-amber-500">Системная память · v{campaign.state.version || 0}</p><strong className="block mt-2 text-sm">Герой, связи, карта и задания</strong><span className="text-xs text-zinc-500 mt-1 block">Все изменения подтверждены движком</span></button><div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase text-zinc-600">Герой</p><strong className="block mt-2">{activeCharacter.name}</strong><span className="text-xs text-zinc-500">{activeCharacter.race} · {activeCharacter.class}</span><div className="flex flex-wrap gap-2 mt-3 text-xs"><span className={`px-2 py-1 rounded ${isIncapsipated ? 'bg-red-500/20 text-red-300 font-bold' : 'bg-red-500/10 text-red-400'}`}>{isIncapsipated ? '☠' : '♥'} {activeCharacter.hp_current}/{activeCharacter.hp_max}</span><span className="px-2 py-1 rounded bg-zinc-800">ур. {activeCharacter.level}</span><span className="px-2 py-1 rounded bg-amber-500/10 text-amber-300">{activeCharacter.gold || 0} зол.</span></div></div>{personalHook && <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><p className="text-xs uppercase text-violet-400">Личная цель</p><p className="text-xs leading-relaxed text-zinc-300 mt-2">{personalHook}</p></div>}<div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase text-zinc-600">Группа</p><div className="mt-3 space-y-2">{characters.map(character => <div key={character.id} className="flex items-center justify-between text-xs"><span>{character.name}{character.hp_current <= 0 ? ' ☠' : ''}</span><span className={character.hp_current <= 0 ? 'text-red-400 font-bold' : 'text-zinc-600'}>{character.hp_current} HP</span></div>)}</div></div><button onClick={() => setShowArchive(true)} className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left hover:border-amber-500/30"><p className="text-xs uppercase text-zinc-600">Хроника</p><strong className="block mt-2 text-sm">Прочитать предыдущие сцены</strong><span className="text-xs text-zinc-500 mt-1 block">Сохранено: {campaign.state.completedSceneIds.length}</span></button><div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase text-zinc-600">Инвентарь истории</p><div className="mt-2 flex flex-wrap gap-1">{campaign.state.inventory.length ? campaign.state.inventory.map(item => <span key={item} className="text-[10px] px-2 py-1 rounded bg-zinc-800">{item}</span>) : <span className="text-xs text-zinc-600">Пусто</span>}</div></div></aside>
    </div>
    {showInventory && <Suspense fallback={<div className="fixed inset-0 z-[90] bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-amber-400"/></div>}><InventoryPanel character={activeCharacter} campaignId={campaign.id} currentUserId={currentUserId} location={scene.location} sceneNumber={campaign.state.sceneNumber} canTrade={canTradeHere} initialTab={inventoryInitialTab} onSave={onCharacterUpdate} onClose={() => setShowInventory(false)}/></Suspense>}
    {showArchive && <Suspense fallback={<div className="fixed inset-0 z-[95] bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-amber-400"/></div>}><SceneArchive campaignId={campaign.id} campaignTitle={campaign.bible.title} acts={campaign.bible.acts} currentScene={scene} currentSceneNumber={campaign.state.sceneNumber} onClose={() => setShowArchive(false)}/></Suspense>}
    {showJournal && <Suspense fallback={<div className="fixed inset-0 z-[98] bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-amber-400"/></div>}><AdventureJournal campaign={campaign} character={activeCharacter} onClose={() => setShowJournal(false)}/></Suspense>}
    {pendingBattle && <Suspense fallback={<div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"><Loader2 className="animate-spin text-amber-400"/></div>}><BattleModal isOpen enemies={pendingBattle.data.enemies} playerStats={toCharacterStats(activeCharacter)} playerName={activeCharacter.name} rewards={pendingBattle.data.rewards} onBattleEnd={finishBattle} onClose={() => setPendingBattle(null)}/></Suspense>} 
  </div>;
}

function chooseActor(choice: StoryChoice, characters: Character[], fallback: Character, difficulty: CampaignRuntime['preferences']['difficulty'] = 'normal', failureStreak = 0): Character {
  if (!choice.check || characters.length <= 1) return fallback;
  return [...characters].sort((left, right) => (previewChoiceCheck(choice, right, { difficulty, failureStreak })?.successChance || 0) - (previewChoiceCheck(choice, left, { difficulty, failureStreak })?.successChance || 0))[0] || fallback;
}

function savepointError(message: string): string {
  return /campaign_savepoints|campaign_stories|schema cache|relation/i.test(message)
    ? `Система временных линий ещё не установлена. Выполните migration_story_timelines_v2.sql. Техническая ошибка: ${message}`
    : message;
}

function toCharacterStats(character: Character): CharacterStats {
  const inventory = normalizeInventory(character);
  const equipped = equippedItemNames(inventory);
  return { name: character.name, race: character.race, class: character.class, level: character.level, hp: { current: character.hp_current, max: character.hp_max }, xp: character.xp, stats: { strength: character.strength, dexterity: character.dexterity, constitution: character.constitution, intelligence: character.intelligence, wisdom: character.wisdom, charisma: character.charisma }, background: character.background, equipment: equipped.length ? equipped : character.equipment, combat_items: quickItemNames(inventory), passive_bonuses: passiveInventoryBonuses(inventory), story_summary: character.story_summary, item_effects: itemEffectsMap(inventory) };
}

function createDefaultBattle(sceneNumber: number): BattleStartData {
  const hp = 6 + sceneNumber * 2;
  return { description: 'Опасность переходит в открытое столкновение.', enemies: [{ id: `foe-${sceneNumber}`, name: 'Противник', hp, maxHp: hp, ac: 11 + Math.min(4, Math.floor(sceneNumber / 3)), initiative: 10, attacks: [{ name: 'Удар', toHit: 3 + Math.floor(sceneNumber / 4), dice: '1d6', bonus: 1 }], statusEffects: [], xpReward: 25 + sceneNumber * 5 }], rewards: { xp: 25 + sceneNumber * 5, items: [] } };
}
