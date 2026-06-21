import { BattleEnemy, CharacterStats, BattleResult, EnemyAttack } from '../types';

function roll(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(dice: string): number {
  const m = dice.match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/);
  if (!m) return 0;
  let total = 0;
  for (let i = 0; i < parseInt(m[1]); i++) total += roll(parseInt(m[2]));
  return total + (parseInt(m[3]) || 0);
}

export interface AttackOutcome {
  hit: boolean;
  crit: boolean;
  fumble: boolean;
  roll: number;
  total: number;
  damage: number;
  ac: number;
}

export function resolveAttack(
  bonus: number,
  dice: string,
  dmgBonus: number,
  targetAC: number,
  adv: boolean = false
): AttackOutcome {
  let r1 = roll(20), r2 = roll(20);
  let r = adv ? Math.max(r1, r2) : r1;
  const total = r + bonus;
  const crit = r === 20;
  const fumble = r === 1;
  const hit = crit || total >= targetAC;
  let damage = 0;
  if (hit) {
    damage = rollDice(dice) + dmgBonus;
    if (crit) damage += rollDice(dice);
  }
  return { hit, crit, fumble, roll: r, total, damage, ac: targetAC };
}

function getMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function getProf(level: number): number {
  return Math.floor((level + 3) / 4) + 1;
}

export function getPlayerAtkBonus(stats: CharacterStats): number {
  return getMod(stats.stats.strength) + getProf(stats.level);
}

export function getPlayerDmgBonus(stats: CharacterStats): number {
  return getMod(stats.stats.strength);
}

export function getPlayerAC(stats: CharacterStats): number {
  return 10 + getMod(stats.stats.dexterity);
}

export function enemyChooseAttack(enemy: BattleEnemy): EnemyAttack {
  const alive = enemy.attacks.filter(a => a.name);
  if (alive.length === 0) {
    return { name: 'Удар', toHit: 2, dice: '1d4', bonus: 1 };
  }
  return alive[Math.floor(Math.random() * alive.length)];
}

export function sortByInitiative(
  players: { name: string; init: number }[],
  enemies: BattleEnemy[]
): string[] {
  const all: { name: string; init: number }[] = [
    ...players,
    ...enemies.map(e => ({ name: e.id, init: e.initiative })),
  ];
  return all.sort((a, b) => b.init - a.init).map(x => x.name);
}

export function runBattle(
  enemies: BattleEnemy[],
  playerStats: CharacterStats,
  playerName: string
): BattleResult {
  const log: string[] = [];
  let playerHP = playerStats.hp.current;
  const playerMaxHP = playerStats.hp.max;
  let turnEnemies = enemies.map(e => ({ ...e, hp: e.hp }));
  const itemsGained: string[] = [];
  let totalXp = 0;
  const enemiesDefeated: string[] = [];

  const playerAC = getPlayerAC(playerStats);
  const atkBonus = getPlayerAtkBonus(playerStats);
  const dmgBonus = getPlayerDmgBonus(playerStats);
  const turnOrder = sortByInitiative(
    [{ name: 'player', init: roll(20) + getMod(playerStats.stats.dexterity) }],
    turnEnemies
  );

  const MAX_ROUNDS = 50;
  let round = 0;

  while (round < MAX_ROUNDS) {
    round++;
    log.push(`\n**— Раунд ${round} —**`);

    for (const id of turnOrder) {
      if (id === 'player') {
        // Player's turn — handled by UI, this engine processes actions
        // This function is called per-action, not full auto-resolve
        // Return early for player-driven battles
        log.push(`Ход игрока ${playerName}`);
      } else {
        // Enemy turn
        const enemy = turnEnemies.find(e => e.id === id);
        if (!enemy || enemy.hp <= 0) continue;

        const attack = enemyChooseAttack(enemy);
        const res = resolveAttack(attack.toHit, attack.dice, attack.bonus, playerAC);

        if (res.fumble) {
          log.push(`💀 **${enemy.name}** критически промахивается!`);
        } else if (res.hit) {
          playerHP = Math.max(0, playerHP - res.damage);
          log.push(`⚔️ **${enemy.name}** атакует: ${res.roll}+${attack.toHit}=**${res.total}** vs AC ${playerAC} — **Попадание!** Урон: ${res.damage}${res.crit ? ' 🔥 КРИТ!' : ''}`);
        } else {
          log.push(`🛡️ **${enemy.name}** атакует: ${res.roll}+${attack.toHit}=**${res.total}** vs AC ${playerAC} — Промах`);
        }

        if (playerHP <= 0) break;
      }
    }

    if (playerHP <= 0) break;
    const aliveEnemies = turnEnemies.filter(e => e.hp > 0);
    if (aliveEnemies.length === 0) break;
  }

  const victory = playerHP > 0;
  if (victory) {
    for (const e of turnEnemies) {
      enemiesDefeated.push(e.name);
    }
    totalXp = enemies.reduce((s, e) => s + e.xpReward, 0);
  }

  return {
    victory,
    xpGained: victory ? totalXp : 0,
    itemsGained: victory ? (itemsGained.length > 0 ? itemsGained : []) : [],
    damageTaken: playerStats.hp.current - playerHP,
    enemiesDefeated,
    log,
  };
}

export function processPlayerAttack(
  enemyId: string,
  enemies: BattleEnemy[],
  playerStats: CharacterStats
): { damage: number; hit: boolean; crit: boolean; fumble: boolean; enemyHp: number; log: string } {
  const enemy = enemies.find(e => e.id === enemyId);
  if (!enemy || enemy.hp <= 0) return { damage: 0, hit: false, crit: false, fumble: false, enemyHp: 0, log: 'Цель мертва' };

  const atkBonus = getPlayerAtkBonus(playerStats);
  const dmgBonus = getPlayerDmgBonus(playerStats);
  const res = resolveAttack(atkBonus, '1d8', dmgBonus, enemy.ac);

  let logStr = '';
  if (res.fumble) {
    logStr = `💀 **${playerStats.name}** критически промахивается! (${res.roll})`;
  } else if (res.hit) {
    enemy.hp = Math.max(0, enemy.hp - res.damage);
    logStr = `⚔️ **${playerStats.name}** атакует **${enemy.name}**: ${res.roll}+${atkBonus}=**${res.total}** vs AC ${enemy.ac} — **Попадание!** Урон: ${res.damage}${res.crit ? ' 🔥 КРИТ!' : ''}`;
    if (enemy.hp <= 0) logStr += `\n💀 **${enemy.name}** повержен!`;
  } else {
    logStr = `🛡️ **${playerStats.name}** атакует **${enemy.name}**: ${res.roll}+${atkBonus}=**${res.total}** vs AC ${enemy.ac} — Промах`;
  }

  return { damage: res.damage, hit: res.hit, crit: res.crit, fumble: res.fumble, enemyHp: enemy.hp, log: logStr };
}
