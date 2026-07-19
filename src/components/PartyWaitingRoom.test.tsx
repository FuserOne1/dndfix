// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../types';

const mocks = vi.hoisted(() => ({
  rows: [] as Array<{ user_session_id: string; character_snapshot: Character; is_host: boolean; is_ready: boolean }>,
  update: vi.fn(),
  campaignStatus: 'setup',
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => table === 'campaigns' ? ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: mocks.campaignStatus }, error: null }) }) }),
    }) : ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: mocks.rows.map(row => ({ ...row })), error: null }) }),
      }),
      update: (value: { is_ready: boolean }) => {
        mocks.update(value);
        const chain = {
          eq: () => chain,
          select: () => chain,
          maybeSingle: async () => {
            const row = mocks.rows.find(item => item.user_session_id === 'phone')!;
            row.is_ready = value.is_ready;
            return { data: { ...row }, error: null };
          },
        };
        return chain;
      },
    }),
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));

import PartyWaitingRoom from './PartyWaitingRoom';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const character = (id: string, name: string) => ({ id, name, race: 'Человек', class: 'Следопыт' }) as Character;

describe('PartyWaitingRoom', () => {
  it('updates the participant row itself after readiness is saved', async () => {
    mocks.campaignStatus = 'setup';
    mocks.rows = [
      { user_session_id: 'pc', character_snapshot: character('host', 'Ведущий'), is_host: true, is_ready: true },
      { user_session_id: 'phone', character_snapshot: character('guest', 'Игрок'), is_host: false, is_ready: false },
    ];
    render(<PartyWaitingRoom campaignId="ABC123" currentUserId="phone" onBack={vi.fn()} onStartCampaign={vi.fn()} onCampaignStarted={vi.fn()}/>);

    const readyButton = await screen.findByRole('button', { name: 'Я готов' });
    fireEvent.click(readyButton);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Отменить готовность' })).toBeTruthy());
    expect(screen.getAllByText('Готов')).toHaveLength(2);
    expect(mocks.update).toHaveBeenCalledWith({ is_ready: true });

    fireEvent.click(screen.getByRole('button', { name: 'Отменить готовность' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Я готов' })).toBeTruthy());
    expect(screen.getAllByText('Готов')).toHaveLength(1);
    expect(mocks.update).toHaveBeenLastCalledWith({ is_ready: false });
  });

  it('opens the campaign on a guest device even without a realtime event', async () => {
    mocks.campaignStatus = 'playing';
    mocks.rows = [
      { user_session_id: 'pc', character_snapshot: character('host', 'Ведущий'), is_host: true, is_ready: true },
      { user_session_id: 'phone', character_snapshot: character('guest', 'Игрок'), is_host: false, is_ready: true },
    ];
    const onCampaignStarted = vi.fn();
    render(<PartyWaitingRoom campaignId="ABC123" currentUserId="phone" onBack={vi.fn()} onStartCampaign={vi.fn()} onCampaignStarted={onCampaignStarted}/>);
    await waitFor(() => expect(onCampaignStarted).toHaveBeenCalledTimes(1));
  });
});
