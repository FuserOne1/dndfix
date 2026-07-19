// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleEnemy, CharacterStats } from '../types';
import BattleModal from './BattleModal';

const player: CharacterStats = {
  name: 'Герой',
  race: 'Человек',
  class: 'Воин',
  level: 1,
  hp: { current: 20, max: 20 },
  xp: 0,
  stats: { strength: 14, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10 },
  background: '',
  equipment: ['Кожаная броня', 'Щит', 'Зелье лечения'],
  item_effects: { 'Зелье лечения': { heal: 5 } },
};

const enemy: BattleEnemy = {
  id: 'enemy',
  name: 'Орк',
  hp: 30,
  maxHp: 30,
  ac: 12,
  initiative: 0,
  attacks: [{ name: 'Топор', toHit: 100, dice: '1d4', bonus: 0 }],
  statusEffects: [],
  xpReward: 50,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderBattle() {
  return render(
    <BattleModal
      isOpen
      enemies={[enemy]}
      playerStats={player}
      playerName="Герой"
      rewards={{ xp: 50, items: [] }}
      onBattleEnd={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

describe('BattleModal turn rules', () => {
  it('сохраняет бонус защиты во время атаки противника', async () => {
    renderBattle();
    fireEvent.click(screen.getByRole('button', { name: 'Защита' }));
    expect(screen.getByText('AC 17')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Завершить ход →' }));

    await act(async () => { vi.runOnlyPendingTimers(); });

    expect(screen.getByText(/против AC 17/)).toBeTruthy();
  });

  it('зелье расходует бонусное, но не основное действие', () => {
    renderBattle();
    fireEvent.click(screen.getByRole('button', { name: 'Зелье' }));
    fireEvent.click(screen.getByRole('button', { name: 'Зелье лечения' }));

    expect((screen.getByRole('button', { name: 'Атака' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Зелье лечения' })).toBeNull();
    expect(screen.getByText(/Бонусное действие использовано/)).toBeTruthy();
  });
});
