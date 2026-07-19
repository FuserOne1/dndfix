import { ItemDefinition } from './types';

export const ITEM_CATALOG: ItemDefinition[] = [
  { id: 'longsword', name: 'Длинный меч', description: 'Надёжный клинок для ближнего боя.', type: 'weapon', rarity: 'common', icon: '⚔', value: 18, slots: 1, stackLimit: 1, equipSlots: ['mainHand'], weaponDice: '1d8', storyTags: ['blade'] },
  { id: 'shortsword', name: 'Короткий меч', description: 'Лёгкий клинок, удобный в тесноте.', type: 'weapon', rarity: 'common', icon: '🗡', value: 12, slots: 1, stackLimit: 1, equipSlots: ['mainHand', 'offHand'], weaponDice: '1d6', storyTags: ['blade', 'finesse'] },
  { id: 'dagger', name: 'Кинжал', description: 'Компактное оружие для ловких рук.', type: 'weapon', rarity: 'common', icon: '†', value: 6, slots: 1, stackLimit: 1, equipSlots: ['mainHand', 'offHand'], weaponDice: '1d4', storyTags: ['blade', 'finesse'] },
  { id: 'great-axe', name: 'Двуручная секира', description: 'Тяжёлое оружие с разрушительным ударом.', type: 'weapon', rarity: 'uncommon', icon: '🪓', value: 34, slots: 2, stackLimit: 1, equipSlots: ['mainHand'], weaponDice: '2d6', storyTags: ['heavy'] },
  { id: 'longbow', name: 'Длинный лук', description: 'Дальнобойное оружие охотников и разведчиков.', type: 'weapon', rarity: 'common', icon: '➶', value: 24, slots: 2, stackLimit: 1, equipSlots: ['mainHand'], weaponDice: '1d8', storyTags: ['bow', 'ranged'] },
  { id: 'crossbow', name: 'Арбалет', description: 'Мощный механический лук.', type: 'weapon', rarity: 'common', icon: '⌁', value: 28, slots: 2, stackLimit: 1, equipSlots: ['mainHand'], weaponDice: '1d8', storyTags: ['crossbow', 'ranged'] },
  { id: 'staff', name: 'Посох', description: 'Фокус для магии и крепкая дорожная опора.', type: 'weapon', rarity: 'common', icon: '╎', value: 8, slots: 2, stackLimit: 1, equipSlots: ['mainHand'], weaponDice: '1d6', storyTags: ['staff', 'arcane'] },
  { id: 'shield', name: 'Щит', description: 'Даёт +2 к защите, пока находится во второй руке.', type: 'shield', rarity: 'common', icon: '⬡', value: 16, slots: 1, stackLimit: 1, equipSlots: ['offHand'], armorClass: 2, storyTags: ['shield'] },
  { id: 'leather-armor', name: 'Кожаная броня', description: 'Лёгкая броня, не мешающая движениям.', type: 'armor', rarity: 'common', icon: '◫', value: 22, slots: 2, stackLimit: 1, equipSlots: ['armor'], armorClass: 11, storyTags: ['leather'] },
  { id: 'chain-mail', name: 'Кольчуга', description: 'Надёжная металлическая броня.', type: 'armor', rarity: 'uncommon', icon: '▦', value: 48, slots: 2, stackLimit: 1, equipSlots: ['armor'], armorClass: 16, storyTags: ['chain'] },
  { id: 'scale-mail', name: 'Чешуйчатая броня', description: 'Компромисс между подвижностью и защитой.', type: 'armor', rarity: 'uncommon', icon: '▧', value: 55, slots: 2, stackLimit: 1, equipSlots: ['armor'], armorClass: 14, storyTags: ['scale'] },
  { id: 'plate-armor', name: 'Латная броня', description: 'Тяжёлые латы для тех, кто может себе их позволить.', type: 'armor', rarity: 'rare', icon: '▣', value: 180, slots: 3, stackLimit: 1, equipSlots: ['armor'], armorClass: 18, storyTags: ['plate', 'heavy'] },
  { id: 'healing-potion', name: 'Зелье лечения', description: 'Восстанавливает 2d4+2 HP.', type: 'consumable', rarity: 'common', icon: '⚗', value: 12, slots: 1, stackLimit: 5, effect: { heal: 7, description: 'Лечебная смесь' }, storyTags: ['healing'] },
  { id: 'greater-healing-potion', name: 'Большое зелье лечения', description: 'Восстанавливает 4d4+4 HP.', type: 'consumable', rarity: 'uncommon', icon: '⚗', value: 32, slots: 1, stackLimit: 3, effect: { heal: 14, description: 'Сильная лечебная смесь' }, storyTags: ['healing'] },
  { id: 'fire-bomb', name: 'Огненная бомба', description: 'Наносит цели 2d6 урона.', type: 'consumable', rarity: 'uncommon', icon: '●', value: 24, slots: 1, stackLimit: 3, effect: { damageDice: '2d6', description: 'Взрывается при ударе' }, storyTags: ['fire', 'bomb'] },
  { id: 'haste-potion', name: 'Зелье скорости', description: 'Временно даёт +2 к атаке и защите.', type: 'consumable', rarity: 'rare', icon: 'ϟ', value: 50, slots: 1, stackLimit: 2, effect: { buffAc: 2, buffAtk: 2, condition: 'Ускорение' }, storyTags: ['speed'] },
  { id: 'lockpicks', name: 'Набор отмычек', description: 'Открывает варианты взлома замков и механизмов.', type: 'tool', rarity: 'common', icon: '⌘', value: 15, slots: 1, stackLimit: 1, storyTags: ['thieves-tools', 'lockpick'] },
  { id: 'craft-tools', name: 'Инструменты ремесла', description: 'Набор для ремонта и изготовления предметов.', type: 'tool', rarity: 'common', icon: '⚒', value: 18, slots: 1, stackLimit: 1, storyTags: ['craft'] },
  { id: 'rope', name: 'Верёвка', description: 'Пятнадцать метров крепкой верёвки.', type: 'tool', rarity: 'common', icon: '∿', value: 4, slots: 1, stackLimit: 1, storyTags: ['rope', 'travel'] },
  { id: 'arcane-focus', name: 'Фокусирующий кристалл', description: 'Усиливает контроль над нестабильной магией.', type: 'accessory', rarity: 'uncommon', icon: '◆', value: 38, slots: 1, stackLimit: 1, equipSlots: ['accessory1', 'accessory2'], effect: { buffAtk: 1, description: '+1 к магическим атакам' }, storyTags: ['arcane'] },
  { id: 'ward-ring', name: 'Кольцо оберега', description: 'Тускло нагревается рядом с опасностью.', type: 'accessory', rarity: 'rare', icon: '○', value: 75, slots: 1, stackLimit: 1, equipSlots: ['accessory1', 'accessory2'], effect: { buffAc: 1, description: '+1 к защите' }, storyTags: ['ward'] },
  { id: 'smoke-charm', name: 'Амулет дымного шага', description: 'Помогает исчезнуть из опасной позиции.', type: 'accessory', rarity: 'rare', icon: '◌', value: 90, slots: 1, stackLimit: 1, equipSlots: ['accessory1', 'accessory2'], storyTags: ['shadow', 'escape'] },
];

export const ITEM_BY_ID = new Map(ITEM_CATALOG.map(item => [item.id, item]));

export function findItemDefinition(name: string): ItemDefinition | undefined {
  const normalized = name.trim().toLocaleLowerCase('ru');
  const exact = ITEM_CATALOG.find(item => item.name.toLocaleLowerCase('ru') === normalized);
  if (exact) return exact;
  const aliases: Array<[RegExp, string]> = [
    [/длинн.*меч/, 'longsword'], [/коротк.*меч/, 'shortsword'], [/кинжал/, 'dagger'], [/секир|двуруч/, 'great-axe'],
    [/длинн.*лук/, 'longbow'], [/арбалет/, 'crossbow'], [/посох|боевой посох/, 'staff'], [/щит/, 'shield'],
    [/кожан.*брон/, 'leather-armor'], [/кольчуг/, 'chain-mail'], [/чешуйн.*брон/, 'scale-mail'], [/лат/, 'plate-armor'],
    [/больш.*зелье.*леч/, 'greater-healing-potion'], [/зелье.*леч/, 'healing-potion'], [/огненн.*бомб/, 'fire-bomb'],
    [/зелье.*скорост/, 'haste-potion'], [/отмыч/, 'lockpicks'], [/инструмент/, 'craft-tools'], [/верёв|верев/, 'rope'], [/кристалл/, 'arcane-focus'],
  ];
  const alias = aliases.find(([pattern]) => pattern.test(normalized));
  return alias ? ITEM_BY_ID.get(alias[1]) : undefined;
}
