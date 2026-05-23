import { Enemy } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Shield, Swords } from 'lucide-react';

interface BattleEnemyPanelProps {
  enemies: Enemy[];
  currentTurn: string;
  round: number;
}

export default function BattleEnemyPanel({ enemies, currentTurn, round }: BattleEnemyPanelProps) {
  return (
    <div className="shrink-0 bg-zinc-900/80 border-b border-zinc-800 p-3 md:p-4">
      <div className="max-w-4xl mx-auto space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Раунд {round}
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-600">
            Ход: <span className="text-primary font-bold">{currentTurn}</span>
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-800 pb-1">
          <AnimatePresence mode="popLayout">
            {enemies.map((enemy) => {
              const hpPercent = (enemy.hp / enemy.maxHp) * 100;
              const isDead = enemy.hp <= 0;
              const isCurrentTurn = currentTurn === enemy.name;

              return (
                <motion.div
                  key={enemy.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8, x: -20 }}
                  animate={{ opacity: isDead ? 0.4 : 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 20 }}
                  className={`shrink-0 w-36 p-3 rounded-xl border-2 transition-all ${
                    isDead
                      ? 'bg-zinc-950 border-zinc-800 opacity-50'
                      : isCurrentTurn
                      ? 'bg-red-950/50 border-red-500 shadow-lg shadow-red-500/20'
                      : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold truncate max-w-[100px] ${isDead ? 'text-zinc-600 line-through' : 'text-white'}`}>
                      {enemy.name}
                    </span>
                    {isDead && (
                      <span className="text-[10px] font-bold text-zinc-600">Dead</span>
                    )}
                  </div>

                  {!isDead && (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-3 h-3 text-zinc-500" />
                        <span className="text-xs font-mono text-zinc-400">{enemy.ac} AC</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Heart className="w-3 h-3 text-red-500" />
                          <span className="text-xs font-mono text-zinc-400">
                            {enemy.hp}/{enemy.maxHp}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(0, hpPercent)}%` }}
                            className={`h-full rounded-full transition-colors ${
                              hpPercent > 50 ? 'bg-red-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-red-700'
                            }`}
                          />
                        </div>
                      </div>

                      {enemy.statusEffects.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {enemy.statusEffects.map((effect, i) => (
                            <span
                              key={i}
                              className="text-[8px] px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 uppercase tracking-wider"
                            >
                              {effect}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
