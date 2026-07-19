// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../types';
import { createStartingInventory, equippedItemNames } from '../game/inventory';
import InventoryPanel from './InventoryPanel';

afterEach(cleanup);

function hero(): Character {
  const inventory = createStartingInventory(['Кольчуга', 'Щит', 'Длинный меч', 'Зелье лечения']);
  return {
    id: 'hero', name: 'Брин', race: 'Дворф', class: 'Авангард', level: 1,
    hp_current: 12, hp_max: 12, xp: 0, strength: 14, dexterity: 10, constitution: 14,
    intelligence: 10, wisdom: 10, charisma: 10, background: 'Ветеран', gold: 24,
    equipment: equippedItemNames(inventory), inventory_data: inventory,
    created_at: '', updated_at: '',
  };
}

describe('InventoryPanel', () => {
  it('shows equipped items, capacity, gold and locks trade outside a campaign', () => {
    render(<InventoryPanel character={hero()} onSave={vi.fn()} onClose={vi.fn()}/>);
    expect(screen.getByText('Брин')).toBeTruthy();
    expect(screen.getAllByText('Длинный меч').length).toBeGreaterThan(0);
    expect(screen.getByText('5/18')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Торговля' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
