import {
  BattleEnemy,
  BattleRewards,
  BattleStartData,
  CharacterStats,
  EnemyAttack,
  ItemEffect,
} from '../types';

const MAX_DICE_COUNT = 100;
const MAX_DICE_SIDES = 1000;

function roll(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(dice: string): number {
  const match = dice.trim().match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!match) return 0;

  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (!Number.isInteger(count) || !Number.isInteger(sides) || count < 1 || sides < 2 || count > MAX_DICE_COUNT || sides > MAX_DICE_SIDES) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < count; i++) total += roll(sides);
  const modifier = Number(match[4] || 0) * (match[3] === '-' ? -1 : 1);
  return total + modifier;
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
  advantage = false,
): AttackOutcome {
  const first = roll(20);
  const second = advantage ? roll(20) : first;
  const attackRoll = advantage ? Math.max(first, second) : first;
  const total = attackRoll + bonus;
  const crit = attackRoll === 20;
  const fumble = attackRoll === 1;
  const hit = !fumble && (crit || total >= targetAC);
  const baseDamage = hit ? rollDice(dice) : 0;
  const damage = hit ? Math.max(0, baseDamage + dmgBonus + (crit ? rollDice(dice) : 0)) : 0;

  return { hit, crit, fumble, roll: attackRoll, total, damage, ac: targetAC };
}

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function getProficiencyBonus(level: number): number {
  return Math.ceil(Math.max(1, level) / 4) + 1;
}

interface WeaponProfile {
  dice: string;
  ability: 'strength' | 'dexterity';
}

export function getPlayerWeaponProfile(stats: CharacterStats): WeaponProfile {
  const equipment = (stats.equipment || []).join(' ').toLocaleLowerCase('ru');
  const dexterityWeapon = /лук|арбалет|рапир|кинжал|bow|crossbow|rapier|dagger/.test(equipment);
  let dice = '1d8';

  if (/двуруч|greatsword|секир|greataxe/.test(equipment)) dice = '2d6';
  else if (/кинжал|dagger/.test(equipment)) dice = '1d4';
  else if (/коротк.*меч|shortsword/.test(equipment)) dice = '1d6';

  return { dice, ability: dexterityWeapon ? 'dexterity' : 'strength' };
}

export function getPlayerAtkBonus(stats: CharacterStats, temporaryBonus = 0): number {
  const weapon = getPlayerWeaponProfile(stats);
  return getAbilityModifier(stats.stats[weapon.ability]) + getProficiencyBonus(stats.level) + temporaryBonus;
}

export function getPlayerDmgBonus(stats: CharacterStats, temporaryBonus = 0): number {
  const weapon = getPlayerWeaponProfile(stats);
  return getAbilityModifier(stats.stats[weapon.ability]) + temporaryBonus;
}

export function getPlayerAC(stats: CharacterStats, temporaryBonus = 0): number {
  const equipment = (stats.equipment || []).join(' ').toLocaleLowerCase('ru');
  const dexterity = getAbilityModifier(stats.stats.dexterity);
  let ac = 10 + dexterity;

  if (/латы|латн|plate/.test(equipment)) ac = 18;
  else if (/кольчуг|chain mail/.test(equipment)) ac = 16;
  else if (/чешуйн|scale mail/.test(equipment)) ac = 14 + Math.min(2, dexterity);
  else if (/кожан|leather/.test(equipment)) ac = 11 + dexterity;
  if (/щит|shield/.test(equipment)) ac += 2;

  return ac + temporaryBonus;
}

export function enemyChooseAttack(enemy: BattleEnemy): EnemyAttack {
  const attacks = enemy.attacks.filter(attack => attack.name && isValidDice(attack.dice));
  if (attacks.length === 0) return { name: 'Удар', toHit: 2, dice: '1d4', bonus: 1 };
  return attacks[Math.floor(Math.random() * attacks.length)];
}

export interface InitiativeEntry {
  id: string;
  initiative: number;
  kind: 'player' | 'enemy';
}

export function createInitiativeOrder(stats: CharacterStats, enemies: BattleEnemy[]): InitiativeEntry[] {
  const entries: InitiativeEntry[] = [
    { id: 'player', initiative: roll(20) + getAbilityModifier(stats.stats.dexterity), kind: 'player' },
    ...enemies.map(enemy => ({ id: enemy.id, initiative: enemy.initiative, kind: 'enemy' as const })),
  ];
  return entries.sort((left, right) => right.initiative - left.initiative);
}

export function sortByInitiative(
  players: { name: string; init: number }[],
  enemies: BattleEnemy[],
): string[] {
  return [
    ...players.map(player => ({ id: player.name, initiative: player.init })),
    ...enemies.map(enemy => ({ id: enemy.id, initiative: enemy.initiative })),
  ].sort((left, right) => right.initiative - left.initiative).map(entry => entry.id);
}

export interface ItemUseResult {
  found: boolean;
  log: string;
  healAmount: number;
  tempHpAmount: number;
  damageAmount: number;
  buffAc: number;
  buffAtk: number;
  buffDmg: number;
  condition: string;
}

function findItemEffect(itemName: string, effectsMap?: Record<string, ItemEffect>): ItemEffect | undefined {
  const normalizedItem = itemName.trim().toLocaleLowerCase('ru');
  const entries = Object.entries(effectsMap || {});
  const exact = entries.find(([key]) => key.trim().toLocaleLowerCase('ru') === normalizedItem);
  if (exact) return exact[1];
  const fuzzy = entries.find(([key]) => {
    const normalizedKey = key.trim().toLocaleLowerCase('ru');
    return normalizedKey.length >= 3 && (normalizedItem.startsWith(normalizedKey) || normalizedItem.includes(normalizedKey));
  });
  if (fuzzy) return fuzzy[1];

  // Базовые эффекты нужны для старых персонажей: в БД у них ещё нет item_effects.
  if (/велик.*зелье.*леч|greater healing/.test(normalizedItem)) return { heal: rollDice('4d4+4') };
  if (/зелье.*леч|лечебн.*зелье|healing potion/.test(normalizedItem)) return { heal: rollDice('2d4+2') };
  if (/зелье.*скорост|haste potion/.test(normalizedItem)) return { buffAc: 2, buffAtk: 2, condition: 'Ускорение' };
  if (/зелье.*сил|potion of strength/.test(normalizedItem)) return { buffAtk: 2, buffDmg: 2, condition: 'Сила' };
  if (/огненн.*бомб|алхимическ.*огонь|fire bomb|alchemist/.test(normalizedItem)) return { damageDice: '2d6' };
  if (/яд|poison/.test(normalizedItem)) return { buffDmg: 2, condition: 'Оружие отравлено' };
  return undefined;
}

export function processItemEffect(itemName: string, playerStats: CharacterStats): ItemUseResult {
  const result: ItemUseResult = {
    found: false,
    log: '',
    healAmount: 0,
    tempHpAmount: 0,
    damageAmount: 0,
    buffAc: 0,
    buffAtk: 0,
    buffDmg: 0,
    condition: '',
  };
  const effects = findItemEffect(itemName, playerStats.item_effects);
  if (!effects) {
    result.log = `🎒 ${itemName}: боевой эффект не найден`;
    return result;
  }

  result.found = true;
  result.healAmount = Math.max(0, effects.heal || 0);
  result.tempHpAmount = Math.max(0, effects.tempHp || 0);
  result.damageAmount = Math.max(0, effects.damage || 0) + (effects.damageDice ? Math.max(0, rollDice(effects.damageDice)) : 0);
  result.buffAc = effects.buffAc || 0;
  result.buffAtk = effects.buffAtk || 0;
  result.buffDmg = effects.buffDmg || 0;
  result.condition = effects.condition || '';

  const parts = [
    result.healAmount > 0 ? `❤️ +${result.healAmount} HP` : '',
    result.tempHpAmount > 0 ? `🛡️ +${result.tempHpAmount} временных HP` : '',
    result.damageAmount > 0 ? `💥 ${result.damageAmount} урона` : '',
    result.buffAc ? `🛡️ AC ${formatSigned(result.buffAc)}` : '',
    result.buffAtk ? `⚔️ ATK ${formatSigned(result.buffAtk)}` : '',
    result.buffDmg ? `💥 DMG ${formatSigned(result.buffDmg)}` : '',
    result.condition,
    effects.description || '',
  ].filter(Boolean);
  result.log = `🎒 ${playerStats.name} использует ${itemName}${parts.length ? `: ${parts.join(', ')}` : ''}`;
  return result;
}

export function processPlayerAttack(
  enemyId: string,
  enemies: BattleEnemy[],
  playerStats: CharacterStats,
  temporaryAtkBonus = 0,
  temporaryDmgBonus = 0,
): { damage: number; hit: boolean; crit: boolean; fumble: boolean; enemyHp: number; log: string } {
  const enemy = enemies.find(candidate => candidate.id === enemyId);
  if (!enemy || enemy.hp <= 0) {
    return { damage: 0, hit: false, crit: false, fumble: false, enemyHp: 0, log: 'Цель недоступна' };
  }

  const weapon = getPlayerWeaponProfile(playerStats);
  const atkBonus = getPlayerAtkBonus(playerStats, temporaryAtkBonus);
  const dmgBonus = getPlayerDmgBonus(playerStats, temporaryDmgBonus);
  const result = resolveAttack(atkBonus, weapon.dice, dmgBonus, enemy.ac);
  let log = '';

  if (result.fumble) log = `💀 ${playerStats.name} критически промахивается! (${result.roll})`;
  else if (result.hit) {
    enemy.hp = Math.max(0, enemy.hp - result.damage);
    log = `⚔️ ${playerStats.name} атакует ${enemy.name}: ${result.roll}${formatSigned(atkBonus)}=${result.total} против AC ${enemy.ac}. Урон: ${result.damage}${result.crit ? ' 🔥 КРИТ!' : ''}`;
    if (enemy.hp <= 0) log += `\n💀 ${enemy.name} повержен!`;
  } else log = `🛡️ ${playerStats.name} атакует ${enemy.name}: ${result.roll}${formatSigned(atkBonus)}=${result.total} против AC ${enemy.ac}. Промах.`;

  return { damage: result.damage, hit: result.hit, crit: result.crit, fumble: result.fumble, enemyHp: enemy.hp, log };
}

function isValidDice(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = value.trim().match(/^(\d+)d(\d+)(?:\s*[+-]\s*\d+)?$/i);
  return Boolean(match && Number(match[1]) >= 1 && Number(match[1]) <= MAX_DICE_COUNT && Number(match[2]) >= 2 && Number(match[2]) <= MAX_DICE_SIDES);
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function parseBattleStartData(value: unknown): BattleStartData | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.enemies) || raw.enemies.length === 0 || raw.enemies.length > 20) return null;

  const usedIds = new Set<string>();
  const enemies: BattleEnemy[] = raw.enemies.map((entry, index) => {
    const enemy = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const sourceId = typeof enemy.id === 'string' && enemy.id.trim() ? enemy.id.trim() : `enemy-${index + 1}`;
    let id = sourceId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${sourceId}-${suffix++}`;
    usedIds.add(id);
    const hp = finiteNumber(enemy.hp, 10, 1, 100_000);
    const rawAttacks = Array.isArray(enemy.attacks) ? enemy.attacks : [];
    const attacks = rawAttacks.slice(0, 10).flatMap(attackValue => {
      if (!attackValue || typeof attackValue !== 'object') return [];
      const attack = attackValue as Record<string, unknown>;
      if (!isValidDice(attack.dice)) return [];
      return [{
        name: typeof attack.name === 'string' && attack.name.trim() ? attack.name.trim() : 'Удар',
        toHit: finiteNumber(attack.toHit, 2, -20, 50),
        dice: attack.dice,
        bonus: finiteNumber(attack.bonus, 0, -20, 1000),
      }];
    });

    return {
      id,
      name: typeof enemy.name === 'string' && enemy.name.trim() ? enemy.name.trim().slice(0, 80) : `Враг ${index + 1}`,
      hp,
      maxHp: Math.max(hp, finiteNumber(enemy.maxHp, hp, 1, 100_000)),
      ac: finiteNumber(enemy.ac, 10, 1, 50),
      initiative: finiteNumber(enemy.initiative, 0, -20, 50),
      attacks: attacks.length ? attacks : [{ name: 'Удар', toHit: 2, dice: '1d4', bonus: 1 }],
      statusEffects: Array.isArray(enemy.statusEffects) ? enemy.statusEffects.filter((item): item is string => typeof item === 'string').slice(0, 20) : [],
      xpReward: finiteNumber(enemy.xpReward, 25, 0, 1_000_000),
    };
  });

  const rewardValue = raw.rewards && typeof raw.rewards === 'object' ? raw.rewards as Record<string, unknown> : {};
  const rewards: BattleRewards = {
    xp: finiteNumber(rewardValue.xp, 0, 0, 1_000_000),
    items: Array.isArray(rewardValue.items)
      ? [...new Set(rewardValue.items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim().slice(0, 120)))].slice(0, 50)
      : [],
  };

  return {
    enemies,
    rewards,
    description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim().slice(0, 1000) : 'Бой начинается!',
  };
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}
