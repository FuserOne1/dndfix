import type { Character } from '../types';
import { ITEM_BY_ID, ITEM_CATALOG, findItemDefinition } from './items';
import type { EquipmentSlot, InventoryData, InventoryItem, ItemDefinition, MerchantData } from './types';

export const DEFAULT_INVENTORY_CAPACITY = 18;
export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['mainHand', 'offHand', 'armor', 'accessory1', 'accessory2'];

function uid(): string {
  return globalThis.crypto?.randomUUID?.() || `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createInventoryItem(templateId: string, quantity = 1, itemUid = uid()): InventoryItem {
  const definition = ITEM_BY_ID.get(templateId);
  if (!definition) throw new Error(`Неизвестный шаблон предмета: ${templateId}`);
  return { uid: itemUid, templateId, name: definition.name, quantity: Math.max(1, Math.floor(quantity)) };
}

function legacyItem(name: string): InventoryItem {
  const definition = findItemDefinition(name);
  return definition ? createInventoryItem(definition.id) : { uid: uid(), templateId: 'legacy', name, quantity: 1 };
}

export function getItemDefinition(item: InventoryItem): ItemDefinition | undefined {
  return ITEM_BY_ID.get(item.templateId) || findItemDefinition(item.name);
}

export function createStartingInventory(names: string[]): InventoryData {
  let inventory: InventoryData = { version: 1, capacity: DEFAULT_INVENTORY_CAPACITY, items: [], equipped: {}, quickSlots: [null, null, null, null] };
  for (const name of names) inventory = addInventoryItem(inventory, legacyItem(name), true).inventory;
  for (const item of inventory.items) {
    const definition = getItemDefinition(item);
    const mainHand = inventory.items.find(candidate => candidate.uid === inventory.equipped.mainHand);
    const mainHandIsTwoHanded = Boolean(mainHand && (getItemDefinition(mainHand)?.slots || 0) >= 2);
    const openSlot = definition?.equipSlots?.find(slot => !inventory.equipped[slot] && !(slot === 'offHand' && mainHandIsTwoHanded));
    if (openSlot) inventory = equipInventoryItem(inventory, item.uid, openSlot).inventory;
    if (definition?.type === 'consumable') {
      const quickIndex = inventory.quickSlots.findIndex(slot => slot === null);
      if (quickIndex >= 0) inventory = assignQuickSlot(inventory, item.uid, quickIndex);
    }
  }
  return inventory;
}

export function normalizeInventory(character: Pick<Character, 'inventory_data' | 'equipment'>): InventoryData {
  const data = character.inventory_data;
  if (data?.version === 1 && Array.isArray(data.items) && (data.items.length > 0 || !character.equipment?.length)) return {
    ...data,
    capacity: Math.max(1, data.capacity || DEFAULT_INVENTORY_CAPACITY),
    equipped: data.equipped || {},
    quickSlots: [...(data.quickSlots || []), null, null, null, null].slice(0, 4),
  };
  return createStartingInventory(character.equipment || []);
}

export function inventorySlotsUsed(inventory: InventoryData): number {
  return inventory.items.reduce((total, item) => {
    const definition = getItemDefinition(item);
    if (definition?.type === 'quest') return total;
    const stack = Math.max(1, definition?.stackLimit || 1);
    return total + Math.max(1, definition?.slots || 1) * Math.ceil(item.quantity / stack);
  }, 0);
}

export function addInventoryItem(inventory: InventoryData, item: InventoryItem, ignoreCapacity = false): { inventory: InventoryData; error?: string } {
  const definition = getItemDefinition(item);
  const existing = definition && definition.stackLimit > 1 ? inventory.items.find(candidate => candidate.templateId === item.templateId && candidate.quantity < definition.stackLimit) : undefined;
  const nextItems = inventory.items.map(candidate => ({ ...candidate }));
  let remaining = item.quantity;
  if (existing && definition) {
    const target = nextItems.find(candidate => candidate.uid === existing.uid)!;
    const moved = Math.min(remaining, definition.stackLimit - target.quantity);
    target.quantity += moved; remaining -= moved;
  }
  while (remaining > 0) {
    const amount = Math.min(remaining, definition?.stackLimit || 1);
    nextItems.push({ ...item, uid: remaining === item.quantity ? item.uid : uid(), quantity: amount });
    remaining -= amount;
  }
  const next = { ...inventory, items: nextItems };
  if (!ignoreCapacity && inventorySlotsUsed(next) > inventory.capacity) return { inventory, error: 'В рюкзаке недостаточно места' };
  return { inventory: next };
}

export function removeInventoryItem(inventory: InventoryData, itemUid: string, quantity = 1): InventoryData {
  const target = inventory.items.find(item => item.uid === itemUid);
  if (!target) return inventory;
  const nextItems = target.quantity > quantity
    ? inventory.items.map(item => item.uid === itemUid ? { ...item, quantity: item.quantity - quantity } : item)
    : inventory.items.filter(item => item.uid !== itemUid);
  const removedCompletely = !nextItems.some(item => item.uid === itemUid);
  const equipped = { ...inventory.equipped };
  if (removedCompletely) for (const slot of EQUIPMENT_SLOTS) if (equipped[slot] === itemUid) delete equipped[slot];
  const quickSlots = inventory.quickSlots.map(value => removedCompletely && value === itemUid ? null : value);
  return { ...inventory, items: nextItems, equipped, quickSlots };
}

export function equipInventoryItem(inventory: InventoryData, itemUid: string, slot: EquipmentSlot): { inventory: InventoryData; error?: string } {
  const item = inventory.items.find(candidate => candidate.uid === itemUid);
  const definition = item && getItemDefinition(item);
  if (!item || !definition?.equipSlots?.includes(slot)) return { inventory, error: 'Этот предмет нельзя поместить в выбранный слот' };
  const equipped = { ...inventory.equipped, [slot]: itemUid };
  if (slot === 'mainHand' && definition.slots >= 2) delete equipped.offHand;
  if (slot === 'offHand') {
    const main = inventory.items.find(candidate => candidate.uid === equipped.mainHand);
    if ((main && getItemDefinition(main)?.slots || 0) >= 2) delete equipped.mainHand;
  }
  return { inventory: { ...inventory, equipped } };
}

export function unequipSlot(inventory: InventoryData, slot: EquipmentSlot): InventoryData {
  const equipped = { ...inventory.equipped };
  delete equipped[slot];
  return { ...inventory, equipped };
}

export function assignQuickSlot(inventory: InventoryData, itemUid: string | null, index: number): InventoryData {
  if (index < 0 || index >= 4) return inventory;
  if (itemUid) {
    const item = inventory.items.find(candidate => candidate.uid === itemUid);
    if (!item || getItemDefinition(item)?.type !== 'consumable') return inventory;
  }
  const quickSlots = [...inventory.quickSlots];
  quickSlots[index] = itemUid;
  return { ...inventory, quickSlots };
}

export function equippedItemNames(inventory: InventoryData): string[] {
  return EQUIPMENT_SLOTS.map(slot => inventory.items.find(item => item.uid === inventory.equipped[slot])?.name).filter((name): name is string => Boolean(name));
}

export function inventoryItemNames(inventory: InventoryData): string[] {
  return [...new Set(inventory.items.map(item => item.name))];
}

export function quickItemNames(inventory: InventoryData): string[] {
  return inventory.quickSlots.flatMap(itemUid => {
    const item = inventory.items.find(candidate => candidate.uid === itemUid);
    return item ? Array.from({ length: item.quantity }, () => item.name) : [];
  });
}

export function itemEffectsMap(inventory: InventoryData) {
  return Object.fromEntries(inventory.items.flatMap(item => {
    const effect = getItemDefinition(item)?.effect;
    return effect ? [[item.name, effect]] : [];
  }));
}

export function passiveInventoryBonuses(inventory: InventoryData) {
  return Object.values(inventory.equipped).reduce((total, itemUid) => {
    const item = inventory.items.find(candidate => candidate.uid === itemUid);
    const effect = item && getItemDefinition(item)?.effect;
    return { ac: total.ac + (effect?.buffAc || 0), attack: total.attack + (effect?.buffAtk || 0), damage: total.damage + (effect?.buffDmg || 0) };
  }, { ac: 0, attack: 0, damage: 0 });
}

export function consumeItemByName(inventory: InventoryData, name: string): InventoryData {
  const item = inventory.items.find(candidate => candidate.name === name);
  return item ? removeInventoryItem(inventory, item.uid, 1) : inventory;
}

export function addItemByName(inventory: InventoryData, name: string): InventoryData {
  const definition = findItemDefinition(name);
  const item = definition ? createInventoryItem(definition.id) : legacyItem(name);
  return addInventoryItem(inventory, item).inventory;
}

function hash(value: string): number {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return Math.abs(result);
}

export function generateMerchant(location: string, sceneNumber: number): MerchantData {
  const seed = hash(`${location}:${Math.ceil(sceneNumber / 3)}`);
  const rotating = ITEM_CATALOG.filter(item => item.type !== 'quest' && !['healing-potion', 'longsword', 'leather-armor', 'rope'].includes(item.id));
  const selected = Array.from({ length: 6 }, (_, index) => rotating[(seed + index * 7) % rotating.length]);
  const templates = [ITEM_BY_ID.get('healing-potion')!, ITEM_BY_ID.get('rope')!, ITEM_BY_ID.get('dagger')!, ITEM_BY_ID.get('lockpicks')!, ...selected];
  return ensureMerchantBasics({
    key: `merchant-${hash(location).toString(36)}`,
    name: `Лавка у ${location}`,
    buyModifier: 1 + (seed % 16) / 100,
    sellModifier: 0.45,
    stock: [...new Map(templates.map((item, index) => [item.id, { templateId: item.id, quantity: item.type === 'consumable' ? 3 : 1, priceModifier: 1 + ((seed + index) % 11) / 100 }])).values()],
  });
}

export function ensureMerchantBasics(merchant: MerchantData): MerchantData {
  const essentials = ['rope', 'dagger', 'healing-potion', 'lockpicks'];
  const missing = essentials.filter(templateId => !merchant.stock.some(item => item.templateId === templateId));
  const stock = [...missing.map(templateId => ({ templateId, quantity: templateId === 'healing-potion' ? 3 : 1, priceModifier: 0.75 })), ...merchant.stock]
    .map(item => essentials.includes(item.templateId) ? { ...item, priceModifier: Math.min(item.priceModifier, 0.75) } : item);
  return { ...merchant, stock };
}

export function buyPrice(definition: ItemDefinition, merchant: MerchantData, stockModifier = 1): number {
  return Math.max(1, Math.ceil(definition.value * merchant.buyModifier * stockModifier));
}

export function sellPrice(definition: ItemDefinition, merchant: MerchantData): number {
  return Math.max(1, Math.floor(definition.value * merchant.sellModifier));
}
