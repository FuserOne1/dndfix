import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Backpack, BookOpen, Check, ChevronDown, Loader2, Lock, ScrollText, Shield, Users } from 'lucide-react';
import { BattleResult, BattleStartData, Character, CharacterStats } from '../types';
import { supabase } from '../lib/supabase';
import { generateNextScene } from '../game/campaign-generator';
import { CampaignRuntime, ChoiceResolution, StoryChoice } from '../game/types';
import { isChoiceAvailable, resolveChoice } from '../game/rules';
import { addInventoryItem, addItemByName, consumeItemByName, createInventoryItem, equippedItemNames, inventoryItemNames, itemEffectsMap, normalizeInventory, passiveInventoryBonuses, quickItemNames } from '../game/inventory';
import { findItemDefinition } from '../game/items';
import { enterScene, normalizeSceneType, recordCompletedScene } from '../game/scene-director';
const BattleModal = lazy(() => import('./BattleModal'));
const InventoryPanel = lazy(() => import('./InventoryPanel'));

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
  const [error, setError] = useState('');
  const [showJournal, setShowJournal] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [pendingBattle, setPendingBattle] = useState<{ choice: StoryChoice; resolution: ChoiceResolution; data: BattleStartData } | null>(null);
  const isHost = campaign.hostUserId === currentUserId;
  const scene = campaign.currentScene;
  const availableStoryItems = useMemo(() => [...new Set([...campaign.state.inventory, ...inventoryItemNames(normalizeInventory(activeCharacter))])], [activeCharacter, campaign.state.inventory]);

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

  const availableChoices = useMemo(() => scene.choices.map(choice => ({ choice, availability: isChoiceAvailable(choice, activeCharacter, campaign.state.flags, availableStoryItems) })), [activeCharacter, availableStoryItems, campaign.state.flags, scene.choices]);

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
    if (campaign.mode === 'solo') return scene.choices.find(choice => choice.id === selectedChoiceId);
    const counts = votes.reduce<Record<string, number>>((result, vote) => ({ ...result, [vote.choice_id]: (result[vote.choice_id] || 0) + 1 }), {});
    return scene.choices.filter(choice => counts[choice.id]).sort((left, right) => (counts[right.id] || 0) - (counts[left.id] || 0))[0] || scene.choices.find(choice => choice.id === selectedChoiceId);
  }

  async function confirmChoice() {
    const choice = winningChoice();
    if (!choice || resolving) return;
    setResolving(true); setError('');
    try {
      const actor = chooseActor(choice, characters, activeCharacter);
      const resolution = resolveChoice(choice, actor);
      setLastResolution(resolution);
      if (choice.consequences.startsBattle) {
        setPendingBattle({ choice, resolution, data: choice.consequences.battle || createDefaultBattle(campaign.state.sceneNumber) });
        setResolving(false);
        return;
      }
      await continueStory(choice, resolution);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось продолжить историю');
    } finally { setResolving(false); }
  }

  async function continueStory(choice: StoryChoice, resolution: ChoiceResolution) {
      const successFlags = resolution.success ? choice.consequences.successFlags || [] : choice.consequences.failureFlags || [];
      const nextInventory = campaign.state.inventory.filter(item => !resolution.lostItems.includes(item));
      let personalInventory = normalizeInventory(activeCharacter);
      let personalChanged = false;
      if (campaign.mode === 'solo') {
        for (const lost of resolution.lostItems) {
          if (personalInventory.items.some(item => item.name === lost)) {
            personalInventory = consumeItemByName(personalInventory, lost);
            personalChanged = true;
          }
        }
      }
      for (const item of resolution.gainedItems) {
        const definition = campaign.mode === 'solo' ? findItemDefinition(item) : undefined;
        if (definition) {
          const added = addInventoryItem(personalInventory, createInventoryItem(definition.id));
          if (!added.error) { personalInventory = added.inventory; personalChanged = true; continue; }
        }
        if (!nextInventory.includes(item)) nextInventory.push(item);
      }
      if (personalChanged) await onCharacterUpdate({ ...activeCharacter, inventory_data: personalInventory, equipment: equippedItemNames(personalInventory) });
      const nextState = {
        ...campaign.state,
        flags: [...new Set([...campaign.state.flags, ...successFlags])],
        inventory: nextInventory,
        completedSceneIds: [...campaign.state.completedSceneIds, scene.id],
        sceneNumber: campaign.state.sceneNumber + 1,
        director: recordCompletedScene(campaign.state.director, scene, characters),
      };
      const nextScene = await generateNextScene({ bible: campaign.bible, previousScene: scene, resolution, state: nextState, characters, preferences: campaign.preferences });
      const updated: CampaignRuntime = { ...campaign, state: { ...nextState, currentSceneId: nextScene.id, currentActId: nextScene.actId, director: enterScene(nextState.director, nextScene) }, currentScene: nextScene };
      await onUpdate(updated);
      if (campaign.mode === 'party') await supabase.from('campaign_votes').delete().eq('campaign_id', campaign.id).eq('scene_id', scene.id);
  }

  async function finishBattle(result: BattleResult) {
    if (!pendingBattle) return;
    let inventory = normalizeInventory(activeCharacter);
    for (const consumed of result.itemsConsumed) inventory = consumeItemByName(inventory, consumed);
    for (const item of result.itemsGained) inventory = addItemByName(inventory, item);
    const updatedCharacter: Character = { ...activeCharacter, hp_current: result.finalHp, xp: activeCharacter.xp + result.xpGained, equipment: equippedItemNames(inventory), inventory_data: inventory };
    await onCharacterUpdate(updatedCharacter);
    const resolution: ChoiceResolution = {
      ...pendingBattle.resolution,
      success: result.victory,
      summary: result.victory ? `Бой выигран. Побеждены: ${result.enemiesDefeated.join(', ')}.` : 'Герой потерпел поражение в бою.',
      gainedItems: [...new Set([...pendingBattle.resolution.gainedItems, ...result.itemsGained])],
      hpChange: result.finalHp - activeCharacter.hp_current,
    };
    const choice = pendingBattle.choice;
    setPendingBattle(null);
    setResolving(true);
    try { await continueStory(choice, resolution); }
    finally { setResolving(false); }
  }

  async function finishCampaign() {
    if (campaign.mode === 'party' && !isHost) return;
    setResolving(true); setError('');
    try {
      await onUpdate({ ...campaign, status: 'finished' });
      onLeave();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось завершить кампанию');
    } finally { setResolving(false); }
  }

  return <div className="min-h-screen bg-[#09090b] text-zinc-100">
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-3 sm:px-4 py-3"><div className="max-w-6xl mx-auto flex justify-between items-center gap-2"><div className="flex items-center gap-2 sm:gap-3 min-w-0"><button onClick={onLeave} className="shrink-0 p-2.5 rounded-xl border border-zinc-800"><ArrowLeft className="w-4 h-4"/></button><div className="min-w-0"><p className="text-[10px] sm:text-xs text-amber-500 truncate">{campaign.bible.acts.find(act => act.id === scene.actId)?.title || 'Кампания'}</p><h1 className="font-bold text-sm sm:text-base truncate">{campaign.bible.title}</h1></div></div><div className="shrink-0 flex items-center gap-2"><span className="hidden sm:inline text-xs text-zinc-500">Сцена {campaign.state.sceneNumber}</span><button onClick={() => setShowInventory(true)} className="p-2.5 rounded-xl border border-zinc-800" aria-label="Открыть инвентарь"><Backpack className="w-4 h-4"/></button><button onClick={() => setShowJournal(!showJournal)} className="p-2.5 rounded-xl border border-zinc-800" aria-label="Открыть журнал"><ScrollText className="w-4 h-4"/></button></div></div></header>
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_260px] gap-6 p-4 sm:p-8">
      <main className="max-w-3xl w-full mx-auto space-y-7">
        <section><div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-600"><BookOpen className="w-3.5 h-3.5"/>{scene.location}</div><h2 className="text-3xl sm:text-4xl font-black mt-3 text-white">{scene.title}</h2><div className="mt-6 space-y-5 text-[16px] sm:text-[17px] leading-8 text-zinc-300">{scene.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></section>
        {lastResolution && <div className={`p-4 rounded-2xl border ${lastResolution.success ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}><strong>{lastResolution.success ? 'Проверка пройдена' : 'Проверка провалена'}</strong>{lastResolution.roll && <p className="text-xs mt-1">Бросок {lastResolution.roll}, итог {lastResolution.total} против сложности {lastResolution.difficulty}</p>}</div>}
        {error && <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">{error}</div>}
        {normalizeSceneType(scene.type) === 'ending' ? <section className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10"><p className="text-sm text-amber-200">История завершена. Этот финал сохранится в хронике кампании.</p><button disabled={resolving || (campaign.mode === 'party' && !isHost)} onClick={() => void finishCampaign()} className="w-full mt-4 p-4 rounded-2xl bg-amber-500 text-zinc-950 font-black disabled:opacity-40">{campaign.mode === 'party' && !isHost ? 'Ведущий завершает кампанию' : 'Закрыть хронику'}</button></section> : <section className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-bold">Что вы сделаете?</h3>{campaign.mode === 'party' && <span className="text-xs text-zinc-500 flex items-center gap-1"><Users className="w-3.5 h-3.5"/>{votes.length} голосов</span>}</div>{availableChoices.map(({ choice, availability }, index) => { const voteCount = votes.filter(vote => vote.choice_id === choice.id).length; const selected = selectedChoiceId === choice.id || votes.some(vote => vote.user_session_id === currentUserId && vote.choice_id === choice.id); return <button key={choice.id} disabled={!availability.available || resolving} onClick={() => void selectChoice(choice)} className={`w-full text-left p-4 rounded-2xl border transition ${selected ? 'border-amber-400 bg-amber-500/10' : availability.available ? 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600' : 'border-zinc-900 bg-zinc-950 opacity-50'}`}><div className="flex gap-3"><span className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold shrink-0">{availability.available ? index + 1 : <Lock className="w-3 h-3"/>}</span><div className="flex-1"><div className="flex justify-between gap-2"><strong className="text-sm">{choice.label}</strong>{voteCount > 0 && <span className="text-xs text-amber-400">{voteCount}</span>}</div>{choice.description && <p className="text-xs text-zinc-500 mt-1">{choice.description}</p>}{choice.check && <p className="text-[10px] text-violet-400 mt-2 uppercase">Проверка: {choice.check.attribute} · {choice.check.difficulty}</p>}{!availability.available && <p className="text-[10px] text-red-400 mt-1">{availability.reason}</p>}</div></div></button>; })}
          <button disabled={resolving || !winningChoice() || (campaign.mode === 'party' && !isHost)} onClick={() => void confirmChoice()} className="w-full p-4 rounded-2xl bg-amber-500 text-zinc-950 font-black flex justify-center items-center gap-2 disabled:opacity-30">{resolving ? <Loader2 className="animate-spin"/> : <Check/>}{resolving ? 'Пишем следующую сцену…' : campaign.mode === 'party' ? isHost ? 'Подтвердить выбор группы' : 'Ожидаем ведущего' : 'Сделать выбор'}</button>
        </section>}
      </main>
      <aside className="space-y-3"><div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase text-zinc-600">Герой</p><strong className="block mt-2">{activeCharacter.name}</strong><span className="text-xs text-zinc-500">{activeCharacter.race} · {activeCharacter.class}</span><div className="flex gap-2 mt-3 text-xs"><span className="px-2 py-1 rounded bg-red-500/10 text-red-400">♥ {activeCharacter.hp_current}/{activeCharacter.hp_max}</span><span className="px-2 py-1 rounded bg-zinc-800">ур. {activeCharacter.level}</span></div></div><div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase text-zinc-600">Группа</p><div className="mt-3 space-y-2">{characters.map(character => <div key={character.id} className="flex items-center justify-between text-xs"><span>{character.name}</span><span className="text-zinc-600">{character.hp_current} HP</span></div>)}</div></div>{showJournal && <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase text-zinc-600">Журнал</p><p className="text-xs text-zinc-400 mt-2">Пройдено сцен: {campaign.state.completedSceneIds.length}</p><p className="text-xs text-zinc-500 mt-2">Флаги: {campaign.state.flags.join(', ') || 'пока нет'}</p></div>}<div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase text-zinc-600">Инвентарь истории</p><div className="mt-2 flex flex-wrap gap-1">{campaign.state.inventory.length ? campaign.state.inventory.map(item => <span key={item} className="text-[10px] px-2 py-1 rounded bg-zinc-800">{item}</span>) : <span className="text-xs text-zinc-600">Пусто</span>}</div></div></aside>
    </div>
    {showInventory && <Suspense fallback={<div className="fixed inset-0 z-[90] bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-amber-400"/></div>}><InventoryPanel character={activeCharacter} campaignId={campaign.id} currentUserId={currentUserId} location={scene.location} sceneNumber={campaign.state.sceneNumber} canTrade={Boolean(scene.services?.trade || normalizeSceneType(scene.type) === 'trade')} onSave={onCharacterUpdate} onClose={() => setShowInventory(false)}/></Suspense>}
    {pendingBattle && <Suspense fallback={<div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"><Loader2 className="animate-spin text-amber-400"/></div>}><BattleModal isOpen enemies={pendingBattle.data.enemies} playerStats={toCharacterStats(activeCharacter)} playerName={activeCharacter.name} rewards={pendingBattle.data.rewards} onBattleEnd={finishBattle} onClose={() => setPendingBattle(null)}/></Suspense>} 
  </div>;
}

function chooseActor(choice: StoryChoice, characters: Character[], fallback: Character): Character {
  if (!choice.check || characters.length <= 1) return fallback;
  return [...characters].sort((left, right) => right[choice.check!.attribute] - left[choice.check!.attribute])[0] || fallback;
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
