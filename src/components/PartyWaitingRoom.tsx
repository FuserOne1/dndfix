import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Loader2, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Character } from '../types';

interface ParticipantRow { user_session_id: string; character_snapshot: Character; is_host: boolean; is_ready: boolean; }

interface PartyWaitingRoomProps {
  campaignId: string;
  currentUserId: string;
  onBack: () => void;
  onStartCampaign: () => void;
  starting?: boolean;
  externalError?: string;
  onCampaignStarted: () => void;
}

export default function PartyWaitingRoom({ campaignId, currentUserId, onBack, onStartCampaign, starting = false, externalError = '', onCampaignStarted }: PartyWaitingRoomProps) {
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void refresh();
    const channel = supabase.channel(`waiting:${campaignId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_participants', filter: `campaign_id=eq.${campaignId}` }, () => void refresh()).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, payload => { if (payload.new.status === 'playing') onCampaignStarted(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [campaignId, onCampaignStarted]);

  async function refresh() {
    const { data, error: loadError } = await supabase.from('campaign_participants').select('user_session_id, character_snapshot, is_host, is_ready').eq('campaign_id', campaignId).order('joined_at');
    if (loadError) setError(loadError.message); else {
      const rows = (data || []) as ParticipantRow[];
      setParticipants(rows);
      setReady(Boolean(rows.find(row => row.user_session_id === currentUserId)?.is_ready));
    }
  }

  async function toggleReady() {
    const { error: updateError } = await supabase.from('campaign_participants').update({ is_ready: !ready }).eq('campaign_id', campaignId).eq('user_session_id', currentUserId);
    if (updateError) setError(updateError.message); else setReady(!ready);
  }

  async function copyCode() { await navigator.clipboard.writeText(campaignId); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }

  const currentParticipant = participants.find(participant => participant.user_session_id === currentUserId);
  const isHost = Boolean(currentParticipant?.is_host);
  const allReady = participants.length > 0 && participants.every(participant => participant.is_host || participant.is_ready);

  return <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 sm:p-8"><div className="max-w-3xl mx-auto space-y-6"><div className="flex gap-4"><button onClick={onBack} className="p-3 rounded-xl border border-zinc-800"><ArrowLeft/></button><div><p className="text-xs uppercase tracking-[0.2em] text-amber-500">Зал ожидания</p><h1 className="text-3xl font-black">Собирается партия</h1><p className="text-zinc-500 text-sm mt-1">Общайтесь лично или в Discord — здесь только готовность к игре.</p></div></div>
    <button onClick={() => void copyCode()} className="w-full p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-center"><p className="text-xs text-zinc-500 uppercase">Код кампании</p><strong className="text-3xl tracking-[0.3em] text-amber-300">{campaignId}</strong><span className="ml-3 inline-flex">{copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}</span></button>
    {(error || externalError) && <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error || externalError}</div>}
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5"><div className="flex justify-between mb-4"><h2 className="font-bold flex items-center gap-2"><Users className="w-4 h-4 text-amber-400"/>Участники</h2><span className="text-xs text-zinc-500">{participants.length}</span></div><div className="space-y-2">{participants.length ? participants.map(participant => <div key={participant.user_session_id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800"><div><strong className="text-sm">{participant.character_snapshot.name}</strong><p className="text-xs text-zinc-500">{participant.character_snapshot.race} · {participant.character_snapshot.class}{participant.is_host ? ' · ведущий' : ''}</p></div><span className={`text-xs ${participant.is_ready || participant.is_host ? 'text-emerald-400' : 'text-zinc-600'}`}>{participant.is_ready || participant.is_host ? 'Готов' : 'Выбирает'}</span></div>) : <div className="py-8 text-center text-zinc-600"><Loader2 className="animate-spin mx-auto mb-2"/>Загружаем участников…</div>}</div></div>
    {isHost ? <button disabled={!allReady || starting} onClick={onStartCampaign} className="w-full p-4 rounded-2xl bg-amber-500 text-zinc-950 font-black flex items-center justify-center gap-2 disabled:opacity-40">{starting && <Loader2 className="animate-spin"/>}{starting ? 'Создаём кампанию…' : allReady ? 'Начать кампанию' : 'Ждём готовности игроков'}</button> : <button onClick={() => void toggleReady()} className={`w-full p-4 rounded-2xl font-bold ${ready ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-200'}`}>{ready ? '✓ Я готов' : 'Отметить готовность'}</button>}<p className="text-center text-xs text-zinc-600">Сюжет начнёт генерироваться только после нажатия ведущим кнопки «Начать кампанию».</p>
  </div></div>;
}
