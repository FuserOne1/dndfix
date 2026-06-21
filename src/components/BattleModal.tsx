import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, Shield, Heart, Skull, Crosshair, Zap, Briefcase, X, ChevronRight, FlaskRound as Flask } from 'lucide-react';
import { BattleEnemy, CharacterStats, BattleResult, BattleRewards } from '../types';
import { processPlayerAttack, resolveAttack, enemyChooseAttack, getPlayerAC, getPlayerAtkBonus, getPlayerDmgBonus } from '../lib/battle-engine';

interface BattleModalProps {
  isOpen: boolean;
  enemies: BattleEnemy[];
  playerStats: CharacterStats;
  playerName: string;
  rewards: BattleRewards;
  onBattleEnd: (result: BattleResult) => void;
  onClose: () => void;
}

type Phase = 'player_turn' | 'enemy_turn' | 'animating' | 'victory' | 'defeat';

interface LogEntry {
  text: string;
  type: 'attack' | 'defend' | 'spell' | 'item' | 'system' | 'damage' | 'heal' | 'round';
  round: number;
  actor: 'player' | 'enemy' | 'system';
}

export default function BattleModal({ isOpen, enemies, playerStats, playerName, rewards, onBattleEnd, onClose }: BattleModalProps) {
  const [phase, setPhase] = useState<Phase>('player_turn');
  const [turnEnemies, setTurnEnemies] = useState<BattleEnemy[]>(enemies);
  const [playerHP, setPlayerHP] = useState(playerStats.hp.current);
  const [playerMaxHP] = useState(playerStats.hp.max);
  const [round, setRound] = useState(1);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<'none' | 'attack' | 'defend' | 'spell' | 'item'>('none');
  const [playerDefending, setPlayerDefending] = useState(false);
  const [spellInput, setSpellInput] = useState('');
  const [usedMainAction, setUsedMainAction] = useState(false);
  const [usedBonusAction, setUsedBonusAction] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const enemiesRef = useRef(turnEnemies);
  const playerHPRef = useRef(playerHP);
  const roundRef = useRef(round);
  const playerStatsRef = useRef(playerStats);

  useEffect(() => { enemiesRef.current = turnEnemies; }, [turnEnemies]);
  useEffect(() => { playerHPRef.current = playerHP; }, [playerHP]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { playerStatsRef.current = playerStats; }, [playerStats]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const addLog = useCallback((text: string, type: LogEntry['type'], actor: LogEntry['actor']) => {
    setLog(prev => [...prev, { text, type, round: roundRef.current, actor }]);
  }, []);

  const calcAC = useCallback(() => {
    const base = getPlayerAC(playerStatsRef.current);
    return playerDefending ? base + 2 : base;
  }, [playerDefending]);

  const checkEnd = useCallback((currentEnemies: BattleEnemy[], hp: number): boolean => {
    if (hp <= 0) {
      setPhase('defeat');
      addLog('💀 Вы повержены!', 'system', 'system');
      setTimeout(() => {
        onBattleEnd({
          victory: false,
          xpGained: 0,
          itemsGained: [],
          damageTaken: playerStats.hp.current - hp,
          enemiesDefeated: [],
          log: [],
        });
      }, 1500);
      return true;
    }
    const alive = currentEnemies.filter(e => e.hp > 0);
    if (alive.length === 0) {
      setPhase('victory');
      const gainedItems: string[] = [];
      for (const item of rewards.items) {
        if (!gainedItems.includes(item)) gainedItems.push(item);
      }
      const totalXp = rewards.xp > 0 ? rewards.xp : enemies.reduce((s, e) => s + e.xpReward, 0);
      const defeated = enemies.map(e => e.name);
      addLog(`🎉 Победа! XP: +${totalXp}`, 'system', 'system');
      if (gainedItems.length > 0) addLog(`🎒 Добыто: ${gainedItems.join(', ')}`, 'system', 'system');

      setTimeout(() => {
        onBattleEnd({
          victory: true,
          xpGained: totalXp,
          itemsGained: gainedItems,
          damageTaken: playerStats.hp.current - hp,
          enemiesDefeated: defeated,
          log: [],
        });
      }, 1500);
      return true;
    }
    return false;
  }, [enemies, playerStats, addLog, onBattleEnd]);

  const endPlayerTurn = useCallback(() => {
    setUsedMainAction(false);
    setUsedBonusAction(false);
    setPlayerDefending(false);
    setActionMode('none');
    setSelectedEnemyId(null);
    setPhase('enemy_turn');
  }, []);

  const handleAttack = useCallback((enemyId: string) => {
    const eList = enemiesRef.current;
    const enemy = eList.find(e => e.id === enemyId);
    if (!enemy || enemy.hp <= 0) return;

    const result = processPlayerAttack(enemyId, eList, playerStatsRef.current);
    addLog(result.log, result.hit ? 'attack' : 'system', 'player');

    const updated = eList.map(e => e.id === enemyId ? { ...e, hp: result.enemyHp } : e);
    setTurnEnemies(updated);
    setSelectedEnemyId(null);
    setActionMode('none');
    setUsedMainAction(true);

    if (checkEnd(updated, playerHPRef.current)) return;
  }, [addLog, checkEnd]);

  const handleDefend = useCallback(() => {
    setPlayerDefending(true);
    addLog(`🛡️ ${playerName} принимает защитную стойку (+2 AC на раунд)`, 'defend', 'player');
    setActionMode('none');
    setUsedMainAction(true);
  }, [playerName, addLog]);

  const handleCastSpell = useCallback(() => {
    if (!spellInput.trim()) return;
    addLog(`✨ ${playerName} произносит заклинание: ${spellInput.trim()}`, 'spell', 'player');
    setSpellInput('');
    setActionMode('none');
    setUsedMainAction(true);
  }, [spellInput, playerName, addLog]);

  const handleUseItem = useCallback((itemName: string) => {
    addLog(`🎒 ${playerName} использует: ${itemName}`, 'item', 'player');
    setActionMode('none');
    setUsedMainAction(true);
  }, [playerName, addLog]);

  const handleFlee = useCallback(() => {
    addLog(`🏃 ${playerName} отступает!`, 'system', 'player');
    setTimeout(() => {
      onBattleEnd({
        victory: false,
        xpGained: 0,
        itemsGained: [],
        damageTaken: playerStats.hp.current - playerHPRef.current,
        enemiesDefeated: [],
        log: [],
      });
    }, 500);
  }, [playerName, playerStats, onBattleEnd]);

  const processEnemies = useCallback(() => {
    const eList = enemiesRef.current;
    const hp = playerHPRef.current;
    const currentRound = roundRef.current;
    const aliveEnemies = eList.filter(e => e.hp > 0);

    if (aliveEnemies.length === 0 || hp <= 0) {
      setPhase('player_turn');
      return;
    }

    addLog(`— Ход врагов (Раунд ${currentRound}) —`, 'round', 'system');
    let newHP = hp;
    let updatedEnemies = [...eList];
    let idx = 0;

    const processNext = () => {
      if (idx >= aliveEnemies.length) {
        setPlayerHP(newHP);
        setTurnEnemies(updatedEnemies);
        if (checkEnd(updatedEnemies, newHP)) return;
        setRound(prev => prev + 1);
        setPhase('player_turn');
        return;
      }

      const enemy = aliveEnemies[idx];
      const attack = enemyChooseAttack(enemy);
      const ac = calcAC();
      const res = resolveAttack(attack.toHit, attack.dice, attack.bonus, ac);

      if (res.fumble) {
        addLog(`💀 ${enemy.name} критически промахивается!`, 'damage', 'enemy');
      } else if (res.hit) {
        newHP = Math.max(0, newHP - res.damage);
        setPlayerHP(newHP);
        addLog(`⚔️ ${enemy.name} → ${res.roll}+${attack.toHit}=${res.total} vs AC ${ac}`, 'attack', 'enemy');
        addLog(`❤️ Урон: -${res.damage}${res.crit ? ' 🔥 КРИТ!' : ''}`, 'damage', 'enemy');
        if (newHP <= 0) {
          setPhase('defeat');
          addLog('💀 Вы повержены!', 'system', 'system');
          setTimeout(() => {
            onBattleEnd({
              victory: false,
              xpGained: 0,
              itemsGained: [],
              damageTaken: playerStats.hp.current - newHP,
              enemiesDefeated: [],
              log: [],
            });
          }, 1500);
          return;
        }
      } else {
        addLog(`🛡️ ${enemy.name} → ${res.roll}+${attack.toHit}=${res.total} vs AC ${ac} — Промах`, 'defend', 'enemy');
      }

      idx++;
      setTimeout(processNext, 700);
    };

    processNext();
  }, [addLog, checkEnd, calcAC, onBattleEnd, playerStats]);

  useEffect(() => {
    if (phase === 'enemy_turn') {
      setActionMode('none');
      setTimeout(processEnemies, 500);
    }
  }, [phase, processEnemies]);

  const aliveEnemies = turnEnemies.filter(e => e.hp > 0);
  const hpPercent = (playerHP / playerMaxHP) * 100;
  const canMainAction = phase === 'player_turn' && !usedMainAction;
  const canBonusAction = phase === 'player_turn' && !usedBonusAction;
  const playerEquipment = playerStats.equipment || [];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] sm:rounded-2xl bg-zinc-950 sm:border sm:border-zinc-800 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Swords className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-sm font-bold text-white">Битва</span>
                <span className="text-xs font-mono text-zinc-500">Раунд {round}</span>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* ═══ ВРАГИ ═══ */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
                {turnEnemies.map(enemy => {
                  const isDead = enemy.hp <= 0;
                  const isSelected = selectedEnemyId === enemy.id;
                  return (
                    <motion.button
                      key={enemy.id}
                      layout
                      onClick={() => {
                        if (isDead || !canMainAction || actionMode !== 'attack') return;
                        setSelectedEnemyId(enemy.id);
                        handleAttack(enemy.id);
                      }}
                      className={`shrink-0 w-28 rounded-xl border-2 transition-all overflow-hidden text-left ${
                        isDead
                          ? 'bg-zinc-950/80 border-zinc-800 opacity-40'
                          : isSelected
                          ? 'bg-gradient-to-b from-amber-950/60 to-zinc-950 border-amber-500 shadow-lg shadow-amber-500/20'
                          : canMainAction && actionMode === 'attack' && !isDead
                          ? 'bg-gradient-to-b from-red-950/40 to-zinc-950 border-red-500/60 hover:border-red-400 cursor-pointer animate-pulse'
                          : 'bg-zinc-950/80 border-zinc-800/60'
                      }`}
                      disabled={isDead || phase !== 'player_turn'}
                    >
                      <div className="p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[11px] font-bold truncate max-w-[80px] ${isDead ? 'text-zinc-700 line-through' : 'text-white'}`}>
                            {enemy.name}
                          </span>
                          {isDead && <Skull className="w-3 h-3 text-red-900" />}
                          {isSelected && !isDead && <Crosshair className="w-3 h-3 text-amber-400" />}
                        </div>
                        {!isDead && (
                          <>
                            <span className="text-[10px] font-mono text-zinc-500">AC {enemy.ac}</span>
                            <div className="mt-1.5 w-full h-1 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                              <div className={`h-full rounded-full transition-all duration-300 ${(enemy.hp / enemy.maxHp) * 100 > 50 ? 'bg-red-500' : (enemy.hp / enemy.maxHp) * 100 > 20 ? 'bg-amber-500' : 'bg-red-800'}`} style={{ width: `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%` }} />
                            </div>
                            <span className="text-[9px] font-mono text-zinc-600 mt-0.5 block">{enemy.hp}/{enemy.maxHp}</span>
                          </>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* ═══ ХАРАКТЕРИСТИКИ ИГРОКА ═══ */}
              <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-bold text-white">{playerName}</span>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">{playerHP}/{playerMaxHP}</span>
                </div>
                <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, hpPercent)}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className={`h-full rounded-full ${hpPercent > 50 ? 'bg-red-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-red-800'}`}
                  />
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] font-mono text-zinc-600">AC {calcAC()}</span>
                  {playerDefending && <span className="text-[10px] font-bold text-blue-400">🛡️ +2 AC</span>}
                  <span className="text-[10px] font-mono text-zinc-600">ATK +{getPlayerAtkBonus(playerStats)}</span>
                </div>
              </div>

              {/* ═══ КНОПКИ ДЕЙСТВИЙ ═══ */}
              {phase === 'player_turn' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 text-[9px] text-zinc-600 uppercase tracking-wider font-bold">
                    <ChevronRight className="w-2.5 h-2.5" />
                    Основное действие {usedMainAction ? '(использовано)' : ''}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      onClick={() => setActionMode(prev => prev === 'attack' ? 'none' : 'attack')}
                      disabled={!canMainAction}
                      className={`flex items-center justify-center gap-1 px-1 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                        !canMainAction ? 'opacity-30 cursor-not-allowed bg-zinc-900/30 border-zinc-800/30 text-zinc-600'
                        : actionMode === 'attack' ? 'bg-red-600/20 border-red-500/50 text-red-400'
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" /> Атака
                    </button>
                    <button
                      onClick={handleDefend}
                      disabled={!canMainAction}
                      className={`flex items-center justify-center gap-1 px-1 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                        !canMainAction ? 'opacity-30 cursor-not-allowed bg-zinc-900/30 border-zinc-800/30 text-zinc-600'
                        : 'bg-zinc-900/50 border-zinc-800 text-blue-300 hover:bg-zinc-800'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" /> Защита
                    </button>
                    <button
                      onClick={() => setActionMode(prev => prev === 'spell' ? 'none' : 'spell')}
                      disabled={!canMainAction}
                      className={`flex items-center justify-center gap-1 px-1 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                        !canMainAction ? 'opacity-30 cursor-not-allowed bg-zinc-900/30 border-zinc-800/30 text-zinc-600'
                        : actionMode === 'spell' ? 'bg-violet-600/20 border-violet-500/50 text-violet-400'
                        : 'bg-zinc-900/50 border-zinc-800 text-violet-300 hover:bg-zinc-800'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" /> Закл.
                    </button>
                    <button
                      onClick={() => setActionMode(prev => prev === 'item' ? 'none' : 'item')}
                      disabled={!canMainAction}
                      className={`flex items-center justify-center gap-1 px-1 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                        !canMainAction ? 'opacity-30 cursor-not-allowed bg-zinc-900/30 border-zinc-800/30 text-zinc-600'
                        : actionMode === 'item' ? 'bg-amber-600/20 border-amber-500/50 text-amber-400'
                        : 'bg-zinc-900/50 border-zinc-800 text-amber-300 hover:bg-zinc-800'
                      }`}
                    >
                      <Briefcase className="w-3.5 h-3.5" /> Предмет
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-[9px] text-zinc-600 uppercase tracking-wider font-bold">
                    <ChevronRight className="w-2.5 h-2.5" />
                    Бонусное действие {usedBonusAction ? '(использовано)' : ''}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setActionMode(prev => prev === 'item' ? 'none' : 'item')}
                      disabled={!canBonusAction || actionMode === 'item'}
                      className={`flex items-center justify-center gap-1 px-1 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                        !canBonusAction ? 'opacity-30 cursor-not-allowed bg-zinc-900/30 border-zinc-800/30 text-zinc-600'
                        : 'bg-zinc-900/50 border-zinc-800 text-emerald-300 hover:bg-zinc-800'
                      }`}
                    >
                      <Flask className="w-3.5 h-3.5" /> Зелье
                    </button>
                    <button
                      onClick={handleFlee}
                      className="flex items-center justify-center gap-1 px-1 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-800"
                    >
                      🏃 Сдаться
                    </button>
                  </div>

                  {usedMainAction && canBonusAction && (
                    <button onClick={endPlayerTurn} className="w-full py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:bg-zinc-700/50 transition-all">
                      Завершить ход →
                    </button>
                  )}
                </div>
              )}

              {phase === 'enemy_turn' && (
                <div className="flex items-center justify-center gap-2 py-3 text-zinc-500">
                  <div className="w-2 h-2 bg-red-500/50 rounded-full animate-ping" />
                  <span className="text-xs font-mono uppercase tracking-wider">Враги действуют...</span>
                </div>
              )}

              {/* Spell input */}
              {actionMode === 'spell' && (
                <div className="flex gap-2">
                  <input value={spellInput} onChange={e => setSpellInput(e.target.value)} placeholder="Название заклинания..." className="flex-1 bg-zinc-950 border border-violet-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50" onKeyDown={e => { if (e.key === 'Enter' && spellInput.trim()) handleCastSpell(); }} autoFocus />
                  <button onClick={handleCastSpell} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold transition-all hover:bg-violet-500">Каст</button>
                  <button onClick={() => setActionMode('none')} className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs transition-all">X</button>
                </div>
              )}

              {/* Item picker — показывает инвентарь */}
              {actionMode === 'item' && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Выбери предмет:</p>
                  {playerEquipment.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic py-2">Нет предметов в инвентаре</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                      {playerEquipment.map((item, i) => (
                          <button
                            key={i}
                            onClick={() => handleUseItem(item)}
                            disabled={!canMainAction}
                            className="flex items-center gap-1.5 px-2 py-2 rounded-xl border border-amber-800/30 bg-amber-900/10 text-amber-300 text-[10px] font-medium text-left hover:bg-amber-900/20 transition-all truncate"
                          >
                            <Briefcase className="w-3 h-3 shrink-0" />
                            {item}
                          </button>
                        ))}
                    </div>
                  )}
                  <button onClick={() => setActionMode('none')} className="text-[9px] text-zinc-600 underline">Отмена</button>
                </div>
              )}

              {/* Log — сгруппированный по раундам */}
              <div ref={logRef} className="max-h-44 overflow-y-auto space-y-0 p-2 rounded-xl bg-black/30 border border-zinc-800/60 scrollbar-thin scrollbar-thumb-zinc-800">
                {log.length === 0 && <span className="text-[10px] text-zinc-600 italic">Бой начался...</span>}
                {log.map((entry, i) => (
                  <div key={i} className="text-[10px] leading-relaxed">
                    {entry.type === 'round' ? (
                      <div className="flex items-center gap-2 py-1">
                        <div className="flex-1 h-px bg-zinc-800" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-red-500/70">{entry.text}</span>
                        <div className="flex-1 h-px bg-zinc-800" />
                      </div>
                    ) : (
                      <p className={`${entry.actor === 'player' ? 'text-zinc-200' : entry.actor === 'enemy' ? 'text-zinc-400' : 'text-zinc-500'} leading-snug`}>
                        <span className="opacity-50 text-[8px] mr-1 font-mono">{entry.round}.</span>
                        {entry.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Victory / Defeat overlay */}
              {(phase === 'victory' || phase === 'defeat') && (
                <div className="text-center py-6 space-y-2">
                  <div className={`text-3xl ${phase === 'victory' ? 'text-amber-400' : 'text-red-600'}`}>
                    {phase === 'victory' ? '🏆' : '💀'}
                  </div>
                  <p className={`text-lg font-bold ${phase === 'victory' ? 'text-amber-300' : 'text-red-400'}`}>
                    {phase === 'victory' ? 'Победа!' : 'Поражение'}
                  </p>
                  <p className="text-xs text-zinc-500">Закрытие...</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
