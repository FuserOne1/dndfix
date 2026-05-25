import { Enemy } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Shield, Swords, Skull } from 'lucide-react';

interface BattleEnemyPanelProps {
  enemies: Enemy[];
  currentTurn: string;
  round: number;
}

export default function BattleEnemyPanel({ enemies, currentTurn, round }: BattleEnemyPanelProps) {
  const aliveCount = enemies.filter(e => e.hp > 0).length;

  return (
    <div className="shrink-0 bg-gradient-to-b from-zinc-900/90 via-red-950/10 to-zinc-900/90 border-b border-red-900/20 p-3 md:p-4 relative overflow-hidden">
      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.06),transparent_70%)] pointer-events-none animate-vignette" />

      {/* Rune decoration left */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-red-500/20 to-transparent animate-rune-pulse" />
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-red-500/20 to-transparent animate-rune-pulse" style={{ animationDelay: '1.5s' }} />

      <div className="max-w-4xl mx-auto space-y-2 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-red-500/10 border border-red-500/20">
              <Swords className="w-3.5 h-3.5 text-red-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-red-300/80">
              Раунд {round}
            </span>
            <span className="text-[10px] font-mono text-red-500/40 ml-1">
              ({aliveCount} в живых)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
              Ход:
            </span>
            <div className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20">
              <span className="text-xs font-bold text-red-300">{currentTurn}</span>
            </div>
          </div>
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
                  animate={{
                    opacity: isDead ? 0.35 : isCurrentTurn ? 1 : 0.85,
                    scale: isCurrentTurn ? 1.02 : 1,
                    x: 0,
                  }}
                  exit={{ opacity: 0, scale: 0.8, x: 20 }}
                  className={`shrink-0 w-36 rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                    isDead
                      ? 'bg-zinc-950/80 border-zinc-800'
                      : isCurrentTurn
                      ? 'bg-gradient-to-b from-red-950/60 to-zinc-950 border-red-500 shadow-lg shadow-red-500/20'
                      : 'bg-zinc-950/80 border-zinc-800/60 hover:border-zinc-700'
                  }`}
                >
                  {/* Subtle glow on active enemy card */}
                  {isCurrentTurn && !isDead && (
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.1),transparent_60%)] pointer-events-none" />
                  )}

                  <div className="p-3 relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold truncate max-w-[100px] ${isDead ? 'text-zinc-700 line-through' : 'text-white'}`}>
                        {enemy.name}
                      </span>
                      {isDead && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-900">
                          <Skull className="w-3 h-3" />
                          Dead
                        </span>
                      )}
                    </div>

                    {!isDead && (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="w-3 h-3 text-zinc-600" />
                          <span className="text-xs font-mono text-zinc-400">{enemy.ac} AC</span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Heart className="w-3 h-3 text-red-500" />
                            <span className="text-xs font-mono text-zinc-400">
                              {enemy.hp}/{enemy.maxHp}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(0, hpPercent)}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                              className={`h-full rounded-full ${
                                hpPercent > 50 ? 'bg-red-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-red-800'
                              }`}
                            />
                          </div>
                        </div>

                        {enemy.statusEffects.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {enemy.statusEffects.map((effect, i) => (
                              <span
                                key={i}
                                className="text-[8px] px-1.5 py-0.5 bg-red-950/40 border border-red-800/30 rounded text-red-400/80 uppercase tracking-wider"
                              >
                                {effect}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
