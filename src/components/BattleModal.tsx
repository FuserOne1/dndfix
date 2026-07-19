import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Briefcase, ChevronRight, Crosshair, FlaskRound, Heart, Shield, Skull, Swords, Zap } from 'lucide-react';
import { BattleEnemy, BattleResult, BattleRewards, CharacterStats } from '../types';
import {
  createInitiativeOrder,
  enemyChooseAttack,
  getAbilityModifier,
  getPlayerAC,
  getPlayerAtkBonus,
  processItemEffect,
  processPlayerAttack,
  resolveAttack,
  rollDice,
} from '../lib/battle-engine';

interface BattleModalProps {
  isOpen: boolean;
  enemies: BattleEnemy[];
  playerStats: CharacterStats;
  playerName: string;
  rewards: BattleRewards;
  onBattleEnd: (result: BattleResult) => void | Promise<void>;
  onClose: () => void;
}

type Phase = 'player_turn' | 'enemy_turn' | 'victory' | 'defeat';
type ActionMode = 'none' | 'attack' | 'spell' | 'item';
type ItemAction = 'main' | 'bonus';

interface LogEntry {
  text: string;
  round: number;
  actor: 'player' | 'enemy' | 'system';
  divider?: boolean;
}

interface BattleBuffs {
  ac: number;
  attack: number;
  damage: number;
  conditions: string[];
}

function removeOne(items: string[], target: string): string[] {
  const index = items.indexOf(target);
  return index < 0 ? items : [...items.slice(0, index), ...items.slice(index + 1)];
}

export default function BattleModal({ isOpen, enemies, playerStats, playerName, rewards, onBattleEnd, onClose }: BattleModalProps) {
  const initialEnemies = useMemo(() => enemies.map(enemy => ({ ...enemy, attacks: [...enemy.attacks], statusEffects: [...enemy.statusEffects] })), [enemies]);
  const initiativeOrder = useMemo(() => createInitiativeOrder(playerStats, initialEnemies), [initialEnemies, playerStats]);
  const [turnEnemies, setTurnEnemies] = useState(initialEnemies);
  const [playerHP, setPlayerHP] = useState(playerStats.hp.current);
  const [tempHP, setTempHP] = useState(0);
  const [equipment, setEquipment] = useState([...(playerStats.equipment || [])]);
  const [buffs, setBuffs] = useState<BattleBuffs>({ ac: 0, attack: 0, damage: 0, conditions: [] });
  const [turnIndex, setTurnIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(initiativeOrder[0]?.kind === 'enemy' ? 'enemy_turn' : 'player_turn');
  const [round, setRound] = useState(1);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>('none');
  const [itemAction, setItemAction] = useState<ItemAction>('main');
  const [playerDefending, setPlayerDefending] = useState(false);
  const [usedMainAction, setUsedMainAction] = useState(false);
  const [usedBonusAction, setUsedBonusAction] = useState(false);
  const [usedSpells, setUsedSpells] = useState<string[]>([]);
  const [saveError, setSaveError] = useState('');
  const enemiesRef = useRef(turnEnemies);
  const hpRef = useRef(playerHP);
  const tempHpRef = useRef(tempHP);
  const roundRef = useRef(round);
  const finishedRef = useRef(false);
  const consumedItemsRef = useRef<string[]>([]);
  const logEntriesRef = useRef<LogEntry[]>([]);
  const resultRef = useRef<BattleResult | null>(null);
  const timersRef = useRef<number[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { enemiesRef.current = turnEnemies; }, [turnEnemies]);
  useEffect(() => { hpRef.current = playerHP; }, [playerHP]);
  useEffect(() => { tempHpRef.current = tempHP; }, [tempHP]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);
  useEffect(() => () => timersRef.current.forEach(window.clearTimeout), []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const id = window.setTimeout(callback, delay);
    timersRef.current.push(id);
  }, []);

  const addLog = useCallback((text: string, actor: LogEntry['actor'], divider = false) => {
    const entry = { text, actor, divider, round: roundRef.current };
    logEntriesRef.current = [...logEntriesRef.current, entry];
    setLog(logEntriesRef.current);
  }, []);

  const submitResult = useCallback((result: BattleResult) => {
    setSaveError('');
    void Promise.resolve(onBattleEnd(result)).then(onClose).catch(error => {
      console.error('Failed to save battle result:', error);
      setSaveError('Не удалось сохранить результат боя. Проверьте подключение и повторите попытку.');
      addLog('⚠️ Результат боя не сохранён.', 'system');
    });
  }, [addLog, onBattleEnd, onClose]);

  const finishBattle = useCallback((victory: boolean, hp: number, currentEnemies: BattleEnemy[]) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const totalXp = rewards.xp > 0 ? rewards.xp : enemies.reduce((sum, enemy) => sum + enemy.xpReward, 0);
    const result: BattleResult = {
      victory,
      xpGained: victory ? totalXp : 0,
      itemsGained: victory ? [...new Set(rewards.items)] : [],
      itemsConsumed: consumedItemsRef.current,
      finalHp: Math.max(0, Math.min(playerStats.hp.max, hp)),
      damageTaken: Math.max(0, playerStats.hp.current - hp),
      enemiesDefeated: currentEnemies.filter(enemy => enemy.hp <= 0).map(enemy => enemy.name),
      log: logEntriesRef.current.map(entry => entry.text),
    };
    resultRef.current = result;

    setPhase(victory ? 'victory' : 'defeat');
    addLog(victory ? `🏆 Победа! XP: +${result.xpGained}` : '💀 Бой завершён поражением.', 'system');
    schedule(() => submitResult(result), 900);
  }, [addLog, enemies, playerStats.hp.current, playerStats.hp.max, rewards, schedule, submitResult]);

  const advanceTurn = useCallback((fromIndex: number, currentEnemies: BattleEnemy[], hp: number) => {
    if (finishedRef.current) return;
    if (hp <= 0) {
      finishBattle(false, 0, currentEnemies);
      return;
    }
    if (currentEnemies.every(enemy => enemy.hp <= 0)) {
      finishBattle(true, hp, currentEnemies);
      return;
    }

    for (let offset = 1; offset <= initiativeOrder.length; offset++) {
      const nextIndex = (fromIndex + offset) % initiativeOrder.length;
      const entry = initiativeOrder[nextIndex];
      if (entry.kind === 'enemy' && !currentEnemies.some(enemy => enemy.id === entry.id && enemy.hp > 0)) continue;
      if (nextIndex <= fromIndex) {
        setRound(value => value + 1);
        roundRef.current += 1;
      }
      setTurnIndex(nextIndex);
      setActionMode('none');
      setSelectedEnemyId(null);
      if (entry.kind === 'player') {
        setPlayerDefending(false);
        setUsedMainAction(false);
        setUsedBonusAction(false);
        setPhase('player_turn');
        addLog(`— Раунд ${nextIndex <= fromIndex ? roundRef.current : roundRef.current}: ход ${playerName} —`, 'system', true);
      } else setPhase('enemy_turn');
      return;
    }
  }, [addLog, finishBattle, initiativeOrder, playerName]);

  const handleAttack = useCallback((enemyId: string) => {
    if (phase !== 'player_turn' || usedMainAction || finishedRef.current) return;
    const copy = enemiesRef.current.map(enemy => ({ ...enemy }));
    const result = processPlayerAttack(enemyId, copy, playerStats, buffs.attack, buffs.damage);
    const updated = copy.map(enemy => enemy.id === enemyId ? { ...enemy, hp: result.enemyHp } : enemy);
    enemiesRef.current = updated;
    setTurnEnemies(updated);
    setUsedMainAction(true);
    setActionMode('none');
    setSelectedEnemyId(null);
    addLog(result.log, 'player');
    if (updated.every(enemy => enemy.hp <= 0)) finishBattle(true, hpRef.current, updated);
  }, [addLog, buffs.attack, buffs.damage, finishBattle, phase, playerStats, usedMainAction]);

  const handleDefend = useCallback(() => {
    if (phase !== 'player_turn' || usedMainAction) return;
    setPlayerDefending(true);
    setUsedMainAction(true);
    addLog(`🛡️ ${playerName} защищается: +2 AC до следующего хода.`, 'player');
  }, [addLog, phase, playerName, usedMainAction]);

  const handleDamageSpell = useCallback((enemyId: string) => {
    if (phase !== 'player_turn' || usedMainAction || usedSpells.includes('bolt')) return;
    const enemy = enemiesRef.current.find(candidate => candidate.id === enemyId && candidate.hp > 0);
    if (!enemy) return;
    const castingModifier = Math.max(
      getAbilityModifier(playerStats.stats.intelligence),
      getAbilityModifier(playerStats.stats.wisdom),
      getAbilityModifier(playerStats.stats.charisma),
    );
    const result = resolveAttack(castingModifier + Math.ceil(Math.max(1, playerStats.level) / 4) + 1, '1d10', 0, enemy.ac);
    const updated = enemiesRef.current.map(candidate => candidate.id === enemy.id ? { ...candidate, hp: Math.max(0, candidate.hp - result.damage) } : candidate);
    enemiesRef.current = updated;
    setTurnEnemies(updated);
    setUsedMainAction(true);
    setUsedSpells(previous => [...previous, 'bolt']);
    addLog(result.hit ? `✨ Магический снаряд поражает ${enemy.name}: ${result.damage} урона.` : `✨ Магический снаряд не попадает по ${enemy.name}.`, 'player');
    if (updated.every(candidate => candidate.hp <= 0)) finishBattle(true, hpRef.current, updated);
  }, [addLog, finishBattle, phase, playerStats, usedMainAction, usedSpells]);

  const handleHealingSpell = useCallback(() => {
    if (phase !== 'player_turn' || usedBonusAction || usedSpells.includes('heal')) return;
    const castingModifier = Math.max(0, getAbilityModifier(playerStats.stats.wisdom), getAbilityModifier(playerStats.stats.charisma));
    const amount = Math.max(1, rollDice('1d4') + castingModifier);
    const oldHp = hpRef.current;
    const newHp = Math.min(playerStats.hp.max, oldHp + amount);
    hpRef.current = newHp;
    setPlayerHP(newHp);
    setUsedBonusAction(true);
    setUsedSpells(previous => [...previous, 'heal']);
    addLog(`✨ Лечащее слово восстанавливает ${newHp - oldHp} HP.`, 'player');
  }, [addLog, phase, playerStats, usedBonusAction, usedSpells]);

  const handleUseItem = useCallback((itemName: string) => {
    const useAsBonus = itemAction === 'bonus';
    if (phase !== 'player_turn' || (useAsBonus ? usedBonusAction : usedMainAction)) return;
    const result = processItemEffect(itemName, { ...playerStats, equipment });
    if (!result.found) {
      addLog(result.log, 'system');
      return;
    }
    const targetId = selectedEnemyId || (turnEnemies.filter(enemy => enemy.hp > 0).length === 1 ? turnEnemies.find(enemy => enemy.hp > 0)?.id : null);
    if (result.damageAmount > 0 && !targetId) {
      addLog('Сначала выберите цель для предмета.', 'system');
      return;
    }

    let updatedEnemies = enemiesRef.current;
    if (result.damageAmount > 0 && targetId) {
      updatedEnemies = enemiesRef.current.map(enemy => enemy.id === targetId ? { ...enemy, hp: Math.max(0, enemy.hp - result.damageAmount) } : enemy);
      enemiesRef.current = updatedEnemies;
      setTurnEnemies(updatedEnemies);
    }
    const newHp = Math.min(playerStats.hp.max, hpRef.current + result.healAmount);
    hpRef.current = newHp;
    tempHpRef.current = Math.max(tempHpRef.current, result.tempHpAmount);
    setPlayerHP(newHp);
    setTempHP(tempHpRef.current);
    setBuffs(previous => ({
      ac: previous.ac + result.buffAc,
      attack: previous.attack + result.buffAtk,
      damage: previous.damage + result.buffDmg,
      conditions: result.condition ? [...previous.conditions, result.condition] : previous.conditions,
    }));
    setEquipment(previous => removeOne(previous, itemName));
    consumedItemsRef.current = [...consumedItemsRef.current, itemName];
    if (useAsBonus) setUsedBonusAction(true); else setUsedMainAction(true);
    setActionMode('none');
    setSelectedEnemyId(null);
    addLog(result.log, 'player');
    if (updatedEnemies.every(enemy => enemy.hp <= 0)) finishBattle(true, newHp, updatedEnemies);
  }, [addLog, equipment, finishBattle, itemAction, phase, playerStats, selectedEnemyId, turnEnemies, usedBonusAction, usedMainAction]);

  const handleFlee = useCallback(() => {
    if (phase !== 'player_turn' || usedMainAction) return;
    const roll = rollDice('1d20') + getAbilityModifier(playerStats.stats.dexterity);
    const difficulty = 10 + turnEnemies.filter(enemy => enemy.hp > 0).length;
    if (roll >= difficulty) {
      addLog(`🏃 ${playerName} успешно отступает (${roll} против ${difficulty}).`, 'player');
      finishBattle(false, hpRef.current, enemiesRef.current);
    } else {
      addLog(`🏃 Отступление не удалось (${roll} против ${difficulty}).`, 'player');
      setUsedMainAction(true);
      schedule(() => advanceTurn(turnIndex, enemiesRef.current, hpRef.current), 350);
    }
  }, [addLog, advanceTurn, finishBattle, phase, playerName, playerStats.stats.dexterity, schedule, turnEnemies, turnIndex, usedMainAction]);

  const endPlayerTurn = useCallback(() => {
    if (phase !== 'player_turn' || (!usedMainAction && !usedBonusAction)) return;
    advanceTurn(turnIndex, enemiesRef.current, hpRef.current);
  }, [advanceTurn, phase, turnIndex, usedBonusAction, usedMainAction]);

  useEffect(() => {
    if (!isOpen || phase !== 'enemy_turn' || finishedRef.current) return;
    const entry = initiativeOrder[turnIndex];
    const enemy = enemiesRef.current.find(candidate => candidate.id === entry?.id && candidate.hp > 0);
    if (!enemy) {
      advanceTurn(turnIndex, enemiesRef.current, hpRef.current);
      return;
    }

    addLog(`— Ход ${enemy.name} —`, 'system', true);
    schedule(() => {
      if (finishedRef.current) return;
      const attack = enemyChooseAttack(enemy);
      const ac = getPlayerAC(playerStats, buffs.ac + (playerDefending ? 2 : 0));
      const result = resolveAttack(attack.toHit, attack.dice, attack.bonus, ac);
      let newHp = hpRef.current;
      if (result.hit) {
        const absorbed = Math.min(tempHpRef.current, result.damage);
        tempHpRef.current -= absorbed;
        setTempHP(tempHpRef.current);
        newHp = Math.max(0, newHp - (result.damage - absorbed));
        hpRef.current = newHp;
        setPlayerHP(newHp);
        addLog(`⚔️ ${enemy.name}: ${result.roll}+${attack.toHit}=${result.total} против AC ${ac}. Урон: ${result.damage}${absorbed ? ` (${absorbed} поглощено)` : ''}${result.crit ? ' 🔥 КРИТ!' : ''}`, 'enemy');
      } else addLog(result.fumble ? `💀 ${enemy.name} критически промахивается.` : `🛡️ ${enemy.name} промахивается (${result.total} против AC ${ac}).`, 'enemy');
      advanceTurn(turnIndex, enemiesRef.current, newHp);
    }, 650);
  }, [addLog, advanceTurn, buffs.ac, initiativeOrder, isOpen, phase, playerDefending, playerStats, schedule, turnIndex]);

  const aliveEnemies = turnEnemies.filter(enemy => enemy.hp > 0);
  const canMain = phase === 'player_turn' && !usedMainAction;
  const canBonus = phase === 'player_turn' && !usedBonusAction;
  const currentActor = initiativeOrder[turnIndex];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4">
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[92vh] sm:rounded-2xl bg-zinc-950 sm:border sm:border-zinc-800 overflow-hidden flex flex-col">
          <header className="shrink-0 px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
            <div className="flex items-center gap-2"><Swords className="w-4 h-4 text-red-400"/><strong className="text-sm text-white">Битва</strong><span className="text-xs font-mono text-zinc-500">Раунд {round}</span></div>
            <span className="text-[10px] text-zinc-500">Чтобы выйти, используйте «Отступить»</span>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {turnEnemies.map(enemy => {
                const dead = enemy.hp <= 0;
                const selectable = phase === 'player_turn' && !dead && (((actionMode === 'attack' || actionMode === 'spell') && canMain) || actionMode === 'item');
                return (
                  <button key={enemy.id} disabled={!selectable} onClick={() => { setSelectedEnemyId(enemy.id); if (actionMode === 'attack') handleAttack(enemy.id); if (actionMode === 'spell') handleDamageSpell(enemy.id); }} className={`w-32 rounded-xl border-2 p-2.5 text-left transition ${dead ? 'opacity-40 border-zinc-800' : selectedEnemyId === enemy.id ? 'border-amber-500 bg-amber-950/30' : selectable ? 'border-red-500/60 bg-red-950/20' : 'border-zinc-800'}`}>
                    <div className="flex justify-between text-xs font-bold text-white"><span className="truncate">{enemy.name}</span>{dead ? <Skull className="w-3 h-3"/> : selectedEnemyId === enemy.id ? <Crosshair className="w-3 h-3 text-amber-400"/> : null}</div>
                    {!dead && <><span className="text-[10px] text-zinc-500">AC {enemy.ac} · Иниц. {enemy.initiative}</span><div className="h-1 bg-zinc-800 rounded mt-2"><div className="h-full bg-red-500 rounded" style={{ width: `${Math.max(0, enemy.hp / enemy.maxHp * 100)}%` }}/></div><span className="text-[9px] text-zinc-600">{enemy.hp}/{enemy.maxHp}</span></>}
                  </button>
                );
              })}
            </div>

            <section className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
              <div className="flex justify-between"><span className="flex items-center gap-1.5 text-xs font-bold text-white"><Heart className="w-3.5 h-3.5 text-red-500"/>{playerName}</span><span className="text-xs font-mono text-zinc-400">{playerHP}/{playerStats.hp.max}{tempHP > 0 ? ` + ${tempHP} врем.` : ''}</span></div>
              <div className="h-2 bg-zinc-900 rounded mt-2"><div className="h-full bg-red-500 rounded transition-all" style={{ width: `${Math.max(0, playerHP / playerStats.hp.max * 100)}%` }}/></div>
              <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono text-zinc-500"><span>AC {getPlayerAC(playerStats, buffs.ac + (playerDefending ? 2 : 0))}</span><span>ATK {getPlayerAtkBonus(playerStats, buffs.attack) >= 0 ? '+' : ''}{getPlayerAtkBonus(playerStats, buffs.attack)}</span><span>Ход: {currentActor?.kind === 'player' ? playerName : turnEnemies.find(enemy => enemy.id === currentActor?.id)?.name}</span>{buffs.conditions.map(condition => <span key={condition} className="text-violet-400">{condition}</span>)}</div>
            </section>

            {phase === 'player_turn' && (
              <section className="space-y-2">
                <div className="flex items-center gap-1 text-[9px] text-zinc-600 uppercase font-bold"><ChevronRight className="w-3 h-3"/>Основное действие {usedMainAction ? 'использовано' : ''}</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  <ActionButton label="Атака" icon={<Swords className="w-3.5 h-3.5"/>} disabled={!canMain} onClick={() => setActionMode(actionMode === 'attack' ? 'none' : 'attack')}/>
                  <ActionButton label="Защита" icon={<Shield className="w-3.5 h-3.5"/>} disabled={!canMain} onClick={handleDefend}/>
                  <ActionButton label="Снаряд" icon={<Zap className="w-3.5 h-3.5"/>} disabled={!canMain || usedSpells.includes('bolt') || aliveEnemies.length === 0} onClick={() => setActionMode(actionMode === 'spell' ? 'none' : 'spell')}/>
                  <ActionButton label="Предмет" icon={<Briefcase className="w-3.5 h-3.5"/>} disabled={!canMain} onClick={() => { setItemAction('main'); setActionMode('item'); }}/>
                  <ActionButton label="Отступить" icon={<span>🏃</span>} disabled={!canMain} onClick={handleFlee}/>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-zinc-600 uppercase font-bold"><ChevronRight className="w-3 h-3"/>Бонусное действие {usedBonusAction ? 'использовано' : ''}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <ActionButton label="Лечащее слово" icon={<Zap className="w-3.5 h-3.5"/>} disabled={!canBonus || usedSpells.includes('heal')} onClick={handleHealingSpell}/>
                  <ActionButton label="Зелье" icon={<FlaskRound className="w-3.5 h-3.5"/>} disabled={!canBonus} onClick={() => { setItemAction('bonus'); setActionMode('item'); }}/>
                </div>
                {actionMode === 'attack' && <p className="text-xs text-red-400">Выберите противника.</p>}
                {actionMode === 'spell' && <p className="text-xs text-violet-400">Выберите цель магического снаряда.</p>}
                {actionMode === 'item' && <div className="grid grid-cols-2 gap-1.5 p-2 border border-amber-900/30 rounded-xl">{equipment.length ? equipment.map((item, index) => <button key={`${item}-${index}`} onClick={() => handleUseItem(item)} className="text-left text-xs text-amber-300 border border-amber-900/40 rounded-lg p-2 hover:bg-amber-950/30">{item}</button>) : <span className="text-xs text-zinc-600">Нет предметов.</span>}</div>}
                {(usedMainAction || usedBonusAction) && <button onClick={endPlayerTurn} className="w-full py-2 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300 hover:bg-zinc-700">Завершить ход →</button>}
              </section>
            )}

            {phase === 'enemy_turn' && <div className="text-center text-xs text-zinc-500 animate-pulse">Действует противник…</div>}
            {(phase === 'victory' || phase === 'defeat') && <div className="text-center space-y-2"><div className={`text-xl font-bold ${phase === 'victory' ? 'text-amber-400' : 'text-red-500'}`}>{phase === 'victory' ? '🏆 Победа!' : '💀 Поражение'}</div>{saveError && <><p className="text-xs text-red-400">{saveError}</p><button onClick={() => resultRef.current && submitResult(resultRef.current)} className="px-4 py-2 rounded-lg bg-red-700 text-xs font-bold text-white">Повторить сохранение</button></>}</div>}

            <div ref={logRef} className="max-h-48 overflow-y-auto p-2 rounded-xl bg-black/30 border border-zinc-800/60">
              {log.length === 0 && <span className="text-[10px] text-zinc-600 italic">Бой начался. Порядок инициативы определён.</span>}
              {log.map((entry, index) => entry.divider ? <div key={index} className="my-1 text-center text-[9px] uppercase text-red-500/70">{entry.text}</div> : <p key={index} className={`text-[10px] leading-relaxed ${entry.actor === 'player' ? 'text-zinc-200' : entry.actor === 'enemy' ? 'text-zinc-400' : 'text-zinc-500'}`}><span className="opacity-50 mr-1">{entry.round}.</span>{entry.text}</p>)}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ActionButton({ label, icon, disabled, onClick }: { label: string; icon: ReactNode; disabled: boolean; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className="min-h-11 flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-[11px] font-bold uppercase text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed">{icon}{label}</button>;
}
