import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Loader2, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Character } from '../types';
import { HomeAtmosphere } from './HomeScreen';

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
  const [updatingReady, setUpdatingReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [campaignStatus, setCampaignStatus] = useState<'setup' | 'generating' | 'playing'>('setup');
  const onCampaignStartedRef = useRef(onCampaignStarted);
  const participantSyncVersion = useRef(0);
  const campaignStartedHandled = useRef(false);

  useEffect(() => { onCampaignStartedRef.current = onCampaignStarted; }, [onCampaignStarted]);

  const refresh = useCallback(async () => {
    const requestedVersion = participantSyncVersion.current;
    const { data, error: loadError } = await supabase.from('campaign_participants').select('user_session_id, character_snapshot, is_host, is_ready').eq('campaign_id', campaignId).order('joined_at');
    if (loadError) setError(loadError.message);
    else if (requestedVersion === participantSyncVersion.current) {
      setParticipants((data || []) as ParticipantRow[]);
      setError('');
    }
  }, [campaignId]);

  const openCampaignWhenReady = useCallback(async () => {
    if (campaignStartedHandled.current) return;
    const { data } = await supabase.from('campaigns').select('status').eq('id', campaignId).maybeSingle();
    if (data?.status === 'setup' || data?.status === 'generating' || data?.status === 'playing') setCampaignStatus(data.status);
    if (data?.status !== 'playing' || campaignStartedHandled.current) return;
    campaignStartedHandled.current = true;
    onCampaignStartedRef.current();
  }, [campaignId]);

  useEffect(() => {
    void refresh(); void openCampaignWhenReady();
    const channel = supabase.channel(`waiting:${campaignId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_participants', filter: `campaign_id=eq.${campaignId}` }, () => void refresh()).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, payload => { const status = payload.new.status; if (status === 'setup' || status === 'generating' || status === 'playing') setCampaignStatus(status); if (status === 'playing' && !campaignStartedHandled.current) { campaignStartedHandled.current = true; onCampaignStartedRef.current(); } }).subscribe();
    const poll = window.setInterval(() => { void refresh(); void openCampaignWhenReady(); }, 2_500);
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') { void refresh(); void openCampaignWhenReady(); } };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [campaignId, openCampaignWhenReady, refresh]);

  async function toggleReady() {
    const ownRow = participants.find(participant => participant.user_session_id === currentUserId);
    if (!ownRow || ownRow.is_host || updatingReady) return;
    const nextReady = !ownRow.is_ready;
    participantSyncVersion.current += 1;
    setUpdatingReady(true); setError('');
    const { data, error: updateError } = await supabase.from('campaign_participants').update({ is_ready: nextReady }).eq('campaign_id', campaignId).eq('user_session_id', currentUserId).select('user_session_id, character_snapshot, is_host, is_ready').maybeSingle();
    if (updateError) setError(updateError.message);
    else if (!data) setError('Готовность не сохранилась: участник не найден в этой комнате. Войдите по коду заново.');
    else {
      setParticipants(previous => previous.map(participant => participant.user_session_id === currentUserId ? data as ParticipantRow : participant));
      participantSyncVersion.current += 1;
    }
    setUpdatingReady(false);
    if (data && !updateError) await refresh();
  }

  async function copyCode() { await navigator.clipboard.writeText(campaignId); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }

  const currentParticipant = participants.find(participant => participant.user_session_id === currentUserId);
  const isHost = Boolean(currentParticipant?.is_host);
  const ready = Boolean(currentParticipant?.is_ready);
  const allReady = participants.length > 0 && participants.every(participant => participant.is_host || participant.is_ready);

  return <div className="waiting-shell home-shell min-h-screen text-zinc-100"><HomeAtmosphere/><div className="home-content p-4 sm:p-8"><div className="max-w-3xl mx-auto space-y-6"><div className="waiting-header flex gap-4"><button onClick={onBack} className="p-3 rounded-xl border border-zinc-800"><ArrowLeft/></button><div><p className="text-xs uppercase tracking-[0.2em] text-amber-500">Зал ожидания</p><h1 className="text-3xl font-black">Собирается партия</h1><p className="text-zinc-500 text-sm mt-1">Общайтесь лично или в Discord — здесь только готовность к игре.</p></div><span className="waiting-torch" aria-hidden="true">✦</span></div>
    <button onClick={() => void copyCode()} className="waiting-code w-full p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-center"><p className="text-xs text-zinc-500 uppercase">Код кампании</p><strong className="text-3xl tracking-[0.3em] text-amber-300">{campaignId}</strong><span className="ml-3 inline-flex">{copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}</span><small>{copied ? 'Код скопирован' : 'Нажмите, чтобы скопировать приглашение'}</small></button>
    {(error || externalError) && <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error || externalError}</div>}
    <div className="waiting-party rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5"><div className="flex justify-between mb-4"><h2 className="font-bold flex items-center gap-2"><Users className="w-4 h-4 text-amber-400"/>Участники</h2><span className="text-xs text-zinc-500">{participants.length}</span></div><div className="space-y-2">{participants.length ? participants.map((participant, index) => <div key={participant.user_session_id} className="waiting-participant flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800"><span className="waiting-avatar">{participant.character_snapshot.avatar_icon || participant.character_snapshot.name.slice(0, 1)}</span><div className="flex-1"><strong className="text-sm">{participant.character_snapshot.name}</strong><p className="text-xs text-zinc-500">{participant.character_snapshot.race} · {participant.character_snapshot.class}{participant.is_host ? ' · ведущий' : ''}</p></div><span className={`waiting-status text-xs ${participant.is_ready || participant.is_host ? 'is-ready text-emerald-400' : 'text-zinc-600'}`}><i />{participant.is_ready || participant.is_host ? 'Готов' : 'Выбирает'}</span><b className="waiting-number">0{index + 1}</b></div>) : <div className="py-8 text-center text-zinc-600"><Loader2 className="animate-spin mx-auto mb-2"/>Загружаем участников…</div>}</div></div>
    <div className="waiting-action">{isHost ? <button disabled={!allReady || starting} onClick={onStartCampaign} className="waiting-primary w-full p-4 rounded-2xl bg-amber-500 text-zinc-950 font-black flex items-center justify-center gap-2 disabled:opacity-40">{starting && <Loader2 className="animate-spin"/>}{starting ? 'Создаём кампанию…' : allReady ? 'Начать кампанию' : 'Ждём готовности игроков'}</button> : campaignStatus === 'generating' ? <div className="w-full p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/>Claude создаёт кампанию…</div> : <button disabled={!currentParticipant || updatingReady} onClick={() => void toggleReady()} className={`waiting-primary w-full p-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 ${ready ? 'is-cancel bg-zinc-800 text-zinc-200' : 'bg-emerald-500 text-zinc-950'}`}>{updatingReady && <Loader2 className="w-4 h-4 animate-spin"/>}{updatingReady ? 'Сохраняем…' : ready ? 'Отменить готовность' : 'Я готов'}</button>}<p className="text-center text-xs text-zinc-600">Сюжет начнёт генерироваться только после нажатия ведущим кнопки «Начать кампанию».</p></div>
  </div></div></div>;
}
