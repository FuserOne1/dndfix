import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, Shield, Heart, Skull, Crosshair, Zap, Briefcase, Dices, X, ScrollText, ChevronRight } from 'lucide-react';
import { BattleEnemy, CharacterStats, BattleResult, EnemyAttack } from '../types';
import { processPlayerAttack, resolveAttack, enemyChooseAttack, getPlayerAC, getPlayerAtkBonus, getPlayerDmgBonus } from '../lib/battle-engine';

interface BattleModalProps {
  isOpen: boolean;
  enemies: BattleEnemy[];
  playerStats: CharacterStats;
  playerName: string;
  onBattleEnd: (result: BattleResult) => void;
  onClose: () => void;
}

type Phase = 'player_turn' | 'enemy_turn' | 'animating' | 'victory' | 'defeat';

export default function BattleModal({ isOpen, enemies, playerStats, playerName, onBattleEnd, onClose }: BattleModalProps) {
  const [phase, setPhase] = useState<Phase>('player_turn');
  const [turnEnemies, setTurnEnemies] = useState<BattleEnemy[]>(enemies);
  const [playerHP, setPlayerHP] = useState(playerStats.hp.current);
  const [playerMaxHP] = useState(playerStats.hp.max);
  const [round, setRound] = useState(1);
  const [log, setLog] = useState<string[]>([]);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<'none' | 'attack' | 'defend'>('none');
  const [playerDefending, setPlayerDefending] = useState(false);
  const [spellInput, setSpellInput] = useState('');
  const [itemInput, setItemInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const enemiesRef = useRef(turnEnemies);
  const playerHPRef = useRef(playerHP);
  const roundRef = useRef(round);
  const logQueueRef = useRef<string[]>([]);
  const itemsGainedRef = useRef<string[]>([]);

  useEffect(() => { enemiesRef.current = turnEnemies; }, [turnEnemies]);
  useEffect(() => { playerHPRef.current = playerHP; }, [playerHP]);
  useEffect(() => { roundRef.current = round; }, [round]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const addLog = useCallback((line: string) => {
    setLog(prev => [...prev, line]);
  }, []);

  const calcAC = useCallback(() => {
    const base = getPlayerAC(playerStats);
    return playerDefending ? base + 2 : base;
  }, [playerStats, playerDefending]);

  const checkEnd = useCallback((currentEnemies: BattleEnemy[], hp: number): boolean => {
    if (hp <= 0) {
      setPhase('defeat');
      addLog('\n💀 **Вы повержены!**');
      return true;
    }
    const alive = currentEnemies.filter(e => e.hp > 0);
    if (alive.length === 0) {
      setPhase('victory');
      const gainedItems = itemsGainedRef.current;
      const totalXp = enemies.reduce((s, e) => s + e.xpReward, 0);
      const defeated = enemies.map(e => e.name);
      addLog(`\n🎉 **Победа!**\n⭐ XP получено: +${totalXp}`);
      if (gainedItems.length > 0) addLog(`🎒 Найдено: ${gainedItems.join(', ')}`);

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

  const handleAttack = useCallback((enemyId: string) => {
    const eList = enemiesRef.current;
    const enemy = eList.find(e => e.id === enemyId);
    if (!enemy || enemy.hp <= 0) return;

    const result = processPlayerAttack(enemyId, eList, playerStats);
    addLog(result.log);

    const updated = eList.map(e => e.id === enemyId ? { ...e, hp: result.enemyHp } : e);
    setTurnEnemies(updated);
    setSelectedEnemyId(null);
    setActionMode('none');

    if (checkEnd(updated, playerHPRef.current)) return;

    setPhase('enemy_turn');
  }, [playerStats, addLog, checkEnd]);

  const handleDefend = useCallback(() => {
    setPlayerDefending(true);
    addLog(`🛡️ **${playerName}** принимает защитную стойку (+2 AC на раунд)`);
    setActionMode('none');
    setPhase('enemy_turn');
  }, [playerName, addLog]);

  const handleCastSpell = useCallback(() => {
    if (!spellInput.trim()) return;
    addLog(`✨ **${playerName}** произносит заклинание: **${spellInput.trim()}**`);
    setSpellInput('');
    setPhase('enemy_turn');
  }, [spellInput, playerName, addLog]);

  const handleUseItem = useCallback(() => {
    if (!itemInput.trim()) return;
    addLog(`🎒 **${playerName}** использует предмет: **${itemInput.trim()}**`);
    itemsGainedRef.current.push(itemInput.trim());
    setItemInput('');
    setPhase('enemy_turn');
  }, [itemInput, playerName, addLog]);

  const handleFlee = useCallback(() => {
    addLog(`🏃 **${playerName}** отступает!`);
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

  // Enemy turn processing
  const processEnemies = useCallback(() => {
    const eList = enemiesRef.current;
    const hp = playerHPRef.current;
    const currentRound = roundRef.current;
    const aliveEnemies = eList.filter(e => e.hp > 0);

    if (aliveEnemies.length === 0 || hp <= 0) {
      setPhase('player_turn');
      return;
    }

    addLog(`\n**— Ход врагов —**`);
    let newHP = hp;
    let updatedEnemies = [...eList];
    let idx = 0;

    const processNext = () => {
      if (idx >= aliveEnemies.length) {
        setPlayerHP(newHP);
        setTurnEnemies(updatedEnemies);
        setPlayerDefending(false);
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
        addLog(`💀 **${enemy.name}** критически промахивается!`);
      } else if (res.hit) {
        newHP = Math.max(0, newHP - res.damage);
        setPlayerHP(newHP);
        addLog(`⚔️ **${enemy.name}** атакует: ${res.roll}+${attack.toHit}=**${res.total}** vs AC ${ac} — **Попадание!** (-${res.damage} ❤️)${res.crit ? ' 🔥 КРИТ!' : ''}`);
        if (newHP <= 0) {
          setPhase('defeat');
          addLog('\n💀 **Вы повержены!**');
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
        addLog(`🛡️ **${enemy.name}** атакует: ${res.roll}+${attack.toHit}=**${res.total}** vs AC ${ac} — Промах`);
      }

      idx++;
      setTimeout(processNext, 800);
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
              {/* Enemies */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
                {turnEnemies.map(enemy => {
                  const isDead = enemy.hp <= 0;
                  const isSelected = selectedEnemyId === enemy.id;
                  return (
                    <motion.button
                      key={enemy.id}
                      layout
                      onClick={() => {
                        if (isDead || phase !== 'player_turn' || actionMode !== 'attack') return;
                        setSelectedEnemyId(enemy.id);
                        handleAttack(enemy.id);
                      }}
                      className={`shrink-0 w-28 rounded-xl border-2 transition-all overflow-hidden text-left ${
                        isDead
                          ? 'bg-zinc-950/80 border-zinc-800 opacity-40'
                          : isSelected
                          ? 'bg-gradient-to-b from-amber-950/60 to-zinc-950 border-amber-500 shadow-lg shadow-amber-500/20'
                          : actionMode === 'attack' && !isDead
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

              {/* Player HP Bar */}
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
                </div>
              </div>

              {/* Action buttons */}
              {phase === 'player_turn' && (
                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={() => setActionMode(prev => prev === 'attack' ? 'none' : 'attack')} className={`flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${actionMode === 'attack' ? 'bg-red-600/20 border-red-500/50 text-red-400' : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800'}`}>
                    <Swords className="w-3.5 h-3.5" /> Атака
                  </button>
                  <button onClick={handleDefend} className="flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all bg-zinc-900/50 border-zinc-800 text-blue-300 hover:bg-zinc-800">
                    <Shield className="w-3.5 h-3.5" /> Защита
                  </button>
                  <button onClick={() => setActionMode('spell')} className="flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all bg-zinc-900/50 border-zinc-800 text-violet-300 hover:bg-zinc-800">
                    <Zap className="w-3.5 h-3.5" /> Закл.
                  </button>
                  <button onClick={() => setActionMode('item')} className="flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all bg-zinc-900/50 border-zinc-800 text-amber-300 hover:bg-zinc-800">
                    <Briefcase className="w-3.5 h-3.5" /> Предмет
                  </button>
                  <button onClick={handleFlee} className="col-span-2 flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-800">
                    🏃 Сдаться
                  </button>
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

              {/* Item input */}
              {actionMode === 'item' && (
                <div className="flex gap-2">
                  <input value={itemInput} onChange={e => setItemInput(e.target.value)} placeholder="Название предмета..." className="flex-1 bg-zinc-950 border border-amber-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" onKeyDown={e => { if (e.key === 'Enter' && itemInput.trim()) handleUseItem(); }} autoFocus />
                  <button onClick={handleUseItem} className="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold transition-all hover:bg-amber-500">Исп.</button>
                  <button onClick={() => setActionMode('none')} className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs transition-all">X</button>
                </div>
              )}

              {/* Battle Log */}
              <div ref={logRef} className="max-h-40 overflow-y-auto space-y-0.5 p-2 rounded-xl bg-black/30 border border-zinc-800/60 scrollbar-thin scrollbar-thumb-zinc-800">
                {log.length === 0 && <span className="text-[10px] text-zinc-600 italic">Бой начался...</span>}
                {log.map((line, i) => (
                  <p key={i} className="text-[10px] leading-relaxed text-zinc-300">
                    {line.startsWith('\n') ? (
                      <>
                        <br />
                        <span className="text-zinc-300">{line.slice(1)}</span>
                      </>
                    ) : line.startsWith('**—') ? (
                      <span className="text-red-400 font-bold">{line.replace(/\*\*/g, '')}</span>
                    ) : (
                      <>{line}</>
                    )}
                  </p>
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
