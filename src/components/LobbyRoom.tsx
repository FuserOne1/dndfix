import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lobby, Character, LobbyParticipant } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Play, ArrowLeft, Copy, Check, Crown, User, Heart,
  Swords, Shield, Loader2, LogOut, UserCheck, UserX
} from 'lucide-react';

interface LobbyRoomProps {
  lobby: Lobby;
  character: Character;
  userSessionId: string;
  onStartGame: () => void;
  onLeave: () => void;
}

export default function LobbyRoom({
  lobby,
  character,
  userSessionId,
  onStartGame,
  onLeave,
}: LobbyRoomProps) {
  const [participants, setParticipants] = useState<(LobbyParticipant & { character: Character })[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = lobby.created_by === userSessionId;
  // Все готовы если: либо хост один, либо все участники (кроме хоста) готовы
  const allReady = participants.length === 1 || 
    participants.filter(p => p.user_session_id !== userSessionId).every(p => p.is_ready);
  const canStart = isHost && participants.length >= 1;

  console.log('=== LOBBY STATE ===');
  console.log('Lobby created_by:', lobby.created_by);
  console.log('My session ID:', userSessionId);
  console.log('isHost:', isHost);
  console.log('Participants count:', participants.length);
  console.log('All ready:', allReady);
  console.log('Can start:', canStart);

  useEffect(() => {
    console.log('=== LOBBY ROOM MOUNTED ===');
    console.log('Lobby:', lobby);
    console.log('Character:', character);
    console.log('User Session ID:', userSessionId);

    // Небольшая задержка перед первой загрузкой
    setTimeout(() => {
      fetchParticipants();
    }, 500);

    const unsubscribe = subscribeToParticipants();

    // Heartbeat для поддержания активности
    const heartbeat = setInterval(() => {
      updateHeartbeat();
    }, 30000); // Каждые 30 секунд

    return () => {
      console.log('=== LOBBY ROOM UNMOUNTING ===');
      clearInterval(heartbeat);
      unsubscribe();
      // НЕ удаляем участника при размонтировании компонента
      // leaveQuietly();
    };
  }, []);

  const fetchParticipants = async () => {
    try {
      // Получаем участников
      const { data: participantsData, error: participantsError } = await supabase
        .from('lobby_participants')
        .select('*')
        .eq('lobby_id', lobby.id);

      if (participantsError) throw participantsError;

      console.log('Fetched participants:', participantsData);

      // Получаем персонажей отдельно
      if (participantsData && participantsData.length > 0) {
        const characterIds = participantsData.map(p => p.character_id);
        
        const { data: charactersData, error: charactersError } = await supabase
          .from('characters')
          .select('*')
          .in('id', characterIds);

        if (charactersError) throw charactersError;

        console.log('Fetched characters:', charactersData);

        // Объединяем данные вручную
        const combined = participantsData.map(participant => ({
          ...participant,
          character: charactersData?.find(c => c.id === participant.character_id) || null
        }));

        console.log('Combined data:', combined);
        console.log('My session ID:', userSessionId);
        console.log('My character:', character.name);

        setParticipants(combined as any);

        // Проверяем свой статус ready
        const myParticipant = combined.find(p => p.user_session_id === userSessionId);
        if (myParticipant) {
          setIsReady(myParticipant.is_ready);
          console.log('Found my participant:', myParticipant);
        } else {
          console.warn('My participant not found in list!');
        }
      } else {
        console.log('No participants found');
        setParticipants([]);
      }
    } catch (err: any) {
      console.error('Error fetching participants:', err);
      setError(err.message);
    }
  };

  const subscribeToParticipants = () => {
    const channel = supabase
      .channel(`lobby:${lobby.id}:updates`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobby_participants',
          filter: `lobby_id=eq.${lobby.id}`,
        },
        () => {
          fetchParticipants();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lobbies',
          filter: `id=eq.${lobby.id}`,
        },
        (payload) => {
          console.log('=== LOBBY UPDATE RECEIVED ===');
          console.log('Old started_at:', payload.old.started_at);
          console.log('New started_at:', payload.new.started_at);
          // Если лобби стартовало
          if (payload.new.started_at && !payload.old.started_at) {
            console.log('Game started! Calling onStartGame()');
            onStartGame();
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('=== UNSUBSCRIBING FROM LOBBY ===');
      supabase.removeChannel(channel);
    };
  };

  const updateHeartbeat = async () => {
    try {
      await supabase
        .from('lobby_participants')
        .update({ joined_at: new Date().toISOString() })
        .eq('lobby_id', lobby.id)
        .eq('user_session_id', userSessionId);
    } catch (err) {
      console.error('Heartbeat error:', err);
    }
  };

  const toggleReady = async () => {
    console.log('=== TOGGLING READY ===');
    console.log('Current ready state:', isReady);
    console.log('New ready state:', !isReady);
    
    try {
      const { data, error } = await supabase
        .from('lobby_participants')
        .update({ is_ready: !isReady })
        .eq('lobby_id', lobby.id)
        .eq('user_session_id', userSessionId)
        .select();

      if (error) {
        console.error('Toggle ready error:', error);
        throw error;
      }

      console.log('Toggle ready result:', data);
      setIsReady(!isReady);
    } catch (err: any) {
      console.error('Error toggling ready:', err);
      setError(err.message);
    }
  };

  const handleStartGame = async () => {
    if (!canStart) return;

    console.log('=== STARTING GAME ===');
    setIsStarting(true);
    
    try {
      // Обновляем лобби как стартовавшее
      const { data, error } = await supabase
        .from('lobbies')
        .update({
          started_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', lobby.id)
        .select();

      if (error) {
        console.error('Start game error:', error);
        throw error;
      }

      console.log('Lobby updated:', data);
      console.log('Calling onStartGame...');
      
      // Переход в игру
      onStartGame();
    } catch (err: any) {
      console.error('Error starting game:', err);
      setError(err.message);
      setIsStarting(false);
    }
  };

  const handleLeave = async () => {
    console.log('=== EXPLICIT LEAVE ===');
    try {
      const { error } = await supabase
        .from('lobby_participants')
        .delete()
        .eq('lobby_id', lobby.id)
        .eq('user_session_id', userSessionId);

      if (error) {
        console.error('Error leaving:', error);
        throw error;
      }

      console.log('Left successfully');
      onLeave();
    } catch (err: any) {
      console.error('Error leaving lobby:', err);
      setError(err.message);
    }
  };

  const leaveQuietly = async () => {
    console.log('=== LEAVING QUIETLY ===');
    console.log('Deleting participant with session:', userSessionId);
    try {
      const { error } = await supabase
        .from('lobby_participants')
        .delete()
        .eq('lobby_id', lobby.id)
        .eq('user_session_id', userSessionId);
      
      if (error) {
        console.error('Error leaving quietly:', error);
      } else {
        console.log('Left quietly successfully');
      }
    } catch (err) {
      console.error('Exception in leaveQuietly:', err);
    }
  };

  const copyLobbyId = () => {
    navigator.clipboard.writeText(lobby.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLeave}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">{lobby.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-zinc-500">Код лобби: {lobby.id}</p>
                <button
                  onClick={copyLobbyId}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-zinc-500" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl">
            <Users className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-bold text-white">
              {participants.length}/{lobby.max_players}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Participants */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Участники
            </h2>
            <button
              onClick={fetchParticipants}
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Обновить
            </button>
          </div>

          <div className="space-y-3">
            <AnimatePresence>
              {participants.map((participant) => {
                const char = participant.character;
                const isMe = participant.user_session_id === userSessionId;
                const isLobbyHost = participant.user_session_id === lobby.created_by;

                return (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`flex items-center justify-between p-4 bg-zinc-950 border-2 rounded-xl transition-all ${
                      isMe
                        ? 'border-primary'
                        : participant.is_ready
                        ? 'border-green-500/30'
                        : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-zinc-600" />
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white">{char.name}</h3>
                          {isLobbyHost && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full">
                              <Crown className="w-3 h-3 text-amber-400" />
                              <span className="text-[10px] font-bold text-amber-400">Хост</span>
                            </div>
                          )}
                          {isMe && (
                            <span className="text-xs text-primary font-bold">(Вы)</span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500">
                          {char.race} • {char.class} • Ур. {char.level}
                        </p>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-3">
                      {/* HP */}
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-zinc-400">
                          {char.hp_current}/{char.hp_max}
                        </span>
                      </div>

                      {/* Ready Status */}
                      {participant.is_ready ? (
                        <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                          <UserCheck className="w-3 h-3 text-green-400" />
                          <span className="text-xs font-bold text-green-400">Готов</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full">
                          <UserX className="w-3 h-3 text-zinc-500" />
                          <span className="text-xs font-bold text-zinc-500">Не готов</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Empty Slots */}
            {Array.from({ length: lobby.max_players - participants.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center justify-center p-4 bg-zinc-950 border-2 border-dashed border-zinc-800 rounded-xl"
              >
                <span className="text-sm text-zinc-600">Ожидание игрока...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={toggleReady}
            disabled={isStarting}
            className={`flex-1 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              isReady
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-green-600 hover:bg-green-500 text-white'
            }`}
          >
            {isReady ? (
              <>
                <UserX className="w-5 h-5" />
                Отменить готовность
              </>
            ) : (
              <>
                <UserCheck className="w-5 h-5" />
                Готов к игре
              </>
            )}
          </button>

          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={!canStart || isStarting}
              className="flex-1 py-4 bg-primary-hover hover:bg-primary text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isStarting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              {isStarting ? 'Запуск...' : 'Начать игру'}
            </button>
          )}
        </div>

        {/* Info */}
        {isHost && !allReady && participants.length > 1 && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
            <p className="text-sm text-amber-400 text-center">
              Дождитесь, пока все игроки будут готовы
            </p>
          </div>
        )}

        {isHost && participants.length === 1 && (
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
            <p className="text-sm text-blue-400 text-center">
              Вы можете начать игру в одиночку или дождаться других игроков
            </p>
          </div>
        )}

        {!isHost && (
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <p className="text-sm text-zinc-500 text-center">
              {isReady 
                ? 'Ожидание начала игры от хоста...' 
                : 'Нажмите "Готов к игре" когда будете готовы'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
