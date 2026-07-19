import { describe, expect, it } from 'vitest';
import { ITEM_BY_ID } from './items';
import {
  addInventoryItem, assignQuickSlot, buyPrice, createInventoryItem, createStartingInventory, equipInventoryItem,
  equippedItemNames, generateMerchant, inventorySlotsUsed, normalizeInventory, passiveInventoryBonuses,
  removeInventoryItem, sellPrice,
} from './inventory';

describe('inventory rules', () => {
  it('converts legacy starting equipment and equips useful pieces', () => {
    const inventory = createStartingInventory(['Кольчуга', 'Щит', 'Длинный меч', 'Зелье лечения']);
    expect(equippedItemNames(inventory)).toEqual(expect.arrayContaining(['Кольчуга', 'Щит', 'Длинный меч']));
    expect(inventory.quickSlots.filter(Boolean)).toHaveLength(1);
    expect(inventorySlotsUsed(inventory)).toBe(5);
  });

  it('stacks consumables and removes one item at a time', () => {
    let inventory = createStartingInventory(['Зелье лечения']);
    inventory = addInventoryItem(inventory, createInventoryItem('healing-potion', 2, 'more')).inventory;
    const potion = inventory.items.find(item => item.templateId === 'healing-potion')!;
    expect(potion.quantity).toBe(3);
    inventory = removeInventoryItem(inventory, potion.uid, 1);
    expect(inventory.items.find(item => item.uid === potion.uid)?.quantity).toBe(2);
  });

  it('does not overflow backpack capacity', () => {
    const inventory = { ...createStartingInventory([]), capacity: 1 };
    const result = addInventoryItem(inventory, createInventoryItem('plate-armor'));
    expect(result.error).toBe('В рюкзаке недостаточно места');
    expect(result.inventory.items).toHaveLength(0);
  });

  it('two-handed weapon clears the off-hand slot', () => {
    let inventory = createStartingInventory(['Щит', 'Двуручная секира']);
    const axe = inventory.items.find(item => item.templateId === 'great-axe')!;
    inventory = equipInventoryItem(inventory, axe.uid, 'mainHand').inventory;
    expect(inventory.equipped.mainHand).toBe(axe.uid);
    expect(inventory.equipped.offHand).toBeUndefined();
  });

  it('keeps a starting two-handed weapon instead of auto-equipping a later sidearm', () => {
    const inventory = createStartingInventory(['Длинный лук', 'Короткий меч']);
    expect(equippedItemNames(inventory)).toContain('Длинный лук');
    expect(equippedItemNames(inventory)).not.toContain('Короткий меч');
  });

  it('only assigns consumables to quick slots', () => {
    let inventory = createStartingInventory(['Длинный меч', 'Зелье лечения']);
    const sword = inventory.items.find(item => item.templateId === 'longsword')!;
    const before = [...inventory.quickSlots];
    inventory = assignQuickSlot(inventory, sword.uid, 0);
    expect(inventory.quickSlots).toEqual(before);
  });

  it('applies passive bonuses only from equipped items', () => {
    let inventory = createStartingInventory(['Кольцо оберега']);
    const ring = inventory.items[0];
    inventory = equipInventoryItem(inventory, ring.uid, 'accessory1').inventory;
    expect(passiveInventoryBonuses(inventory)).toEqual({ ac: 1, attack: 0, damage: 0 });
  });

  it('creates deterministic finite merchant stock and sane prices', () => {
    const first = generateMerchant('Старый порт', 4);
    const second = generateMerchant('Старый порт', 4);
    expect(first).toEqual(second);
    expect(first.stock.length).toBeGreaterThanOrEqual(6);
    expect(first.stock.every(item => item.quantity > 0)).toBe(true);
    const potion = ITEM_BY_ID.get('healing-potion')!;
    expect(buyPrice(potion, first)).toBeGreaterThan(sellPrice(potion, first));
  });

  it('normalizes old characters without inventory data', () => {
    const inventory = normalizeInventory({ equipment: ['Кинжал'] });
    expect(inventory.items[0].name).toBe('Кинжал');
    expect(inventory.version).toBe(1);
  });

  it('imports legacy equipment after migration added an empty default inventory', () => {
    const empty = createStartingInventory([]);
    const inventory = normalizeInventory({ equipment: ['Щит'], inventory_data: empty });
    expect(inventory.items[0].name).toBe('Щит');
  });
});
