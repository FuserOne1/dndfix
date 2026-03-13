import { useState, useEffect } from 'react';
import Chat from './components/Chat';
import CharacterSelect from './components/CharacterSelect';
import LobbyRoom from './components/LobbyRoom';
import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from './lib/supabase';
import { Lobby, Character } from './types';
import { Plus, LogIn, Swords, Shield, ScrollText, Map as MapIcon, User as UserIcon, Loader2, AlertTriangle, Trash2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [roomInput, setRoomInput] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [recentRooms, setRecentRooms] = useState<{id: string, name: string, characterName?: string, lastPlayed?: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState('theme-emerald');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Lobby system states
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'character-select' | 'lobby' | 'game'>('menu');
  const [currentLobby, setCurrentLobby] = useState<Lobby | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [userSessionId] = useState(() => {
    const stored = localStorage.getItem('user_session_id');
    if (stored) return stored;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('user_session_id', newId);
    return newId;
  });

  // Обработчик события установки PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const beforeInstallPromptEvent = e as any;
      setDeferredPrompt(beforeInstallPromptEvent);
      // Показываем кнопку установки через 5 секунд
      setTimeout(() => setShowInstallPrompt(true), 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('recent_rooms');
    if (saved) {
      try {
        setRecentRooms(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent rooms', e);
      }
    }
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const saveRoomToRecent = (id: string, characterName?: string) => {
    const newRecent = [
      { 
        id, 
        name: `Adventure ${id}`, 
        characterName: characterName || userName,
        lastPlayed: new Date().toISOString()
      }, 
      ...recentRooms.filter(r => r.id !== id)
    ].slice(0, 5);
    setRecentRooms(newRecent);
    localStorage.setItem('recent_rooms', JSON.stringify(newRecent));
  };

  const deleteRoomFromRecent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRoomToDelete(id);
  };

  const confirmFullDelete = async () => {
    if (!roomToDelete) return;
    
    setIsDeleting(true);
    try {
      // 1. Delete messages first (due to foreign key)
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', roomToDelete);
      
      if (msgError) throw msgError;

      // 2. Delete the room
      const { error: roomError } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomToDelete);
      
      if (roomError) throw roomError;

      // 3. Remove from local state
      const newRecent = recentRooms.filter(r => r.id !== roomToDelete);
      setRecentRooms(newRecent);
      localStorage.setItem('recent_rooms', JSON.stringify(newRecent));
      
      setRoomToDelete(null);
    } catch (err: any) {
      setError(`Failed to delete room: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const removeOnlyFromList = () => {
    if (!roomToDelete) return;
    const newRecent = recentRooms.filter(r => r.id !== roomToDelete);
    setRecentRooms(newRecent);
    localStorage.setItem('recent_rooms', JSON.stringify(newRecent));
    setRoomToDelete(null);
  };

  const isPlaceholder = supabaseUrl.includes('your-project-id') || supabaseAnonKey === 'your-anon-key';

  if (!isSupabaseConfigured || isPlaceholder) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-[2rem] shadow-2xl space-y-6 text-center">
          <div className="inline-flex p-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl mb-4">
            <AlertTriangle className="w-12 h-12 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Configuration Required</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Please set your <b>real</b> Supabase credentials in the <b>Secrets</b> panel:
          </p>
          <div className="bg-zinc-950 p-4 rounded-xl text-left font-mono text-xs space-y-2 border border-zinc-800">
            <p className="text-emerald-500">VITE_SUPABASE_URL</p>
            <p className="text-emerald-500">VITE_SUPABASE_ANON_KEY</p>
          </div>
          <p className="text-zinc-500 text-xs italic">
            You can find these in your Supabase Project Settings &gt; API.
          </p>
        </div>
      </div>
    );
  }

  const createRoom = async () => {
    if (!userName.trim()) {
      setError('Пожалуйста, введите имя вашего персонажа.');
      return;
    }
    
    setIsJoining(true);
    setError(null);

    const newLobbyId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    console.log('=== CREATING LOBBY ===');
    console.log('Lobby ID:', newLobbyId);
    console.log('Created by (userName):', userName);
    console.log('Created by (sessionId):', userSessionId);
    
    try {
      // Создаем лобби
      const { data: insertedLobby, error: lobbyError } = await supabase.from('lobbies').insert({
        id: newLobbyId,
        name: `Приключение ${newLobbyId}`,
        created_by: userSessionId, // Используем session ID вместо userName
        max_players: 4,
        is_active: true,
      }).select();

      if (lobbyError) {
        console.error('Lobby insert error:', lobbyError);
        throw lobbyError;
      }

      console.log('Lobby created successfully:', insertedLobby);

      // Получаем созданное лобби
      const { data: lobby, error: fetchError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('id', newLobbyId)
        .single();

      if (fetchError) {
        console.error('Lobby fetch error:', fetchError);
        throw fetchError;
      }

      console.log('Lobby fetched:', lobby);

      setCurrentLobby(lobby);
      setCurrentScreen('character-select');
    } catch (err: any) {
      setError(`Ошибка создания лобби: ${err.message}`);
      console.error('Create lobby error:', err);
    } finally {
      setIsJoining(false);
    }
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setError('Пожалуйста, введите имя вашего персонажа.');
      return;
    }
    if (!roomInput.trim()) {
      setError('Пожалуйста, введите код лобби.');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      // Убираем проверку is_active чтобы можно было вернуться в начатую игру
      const { data: lobby, error: lobbyError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('id', roomInput.toUpperCase())
        .single();

      if (lobbyError || !lobby) {
        setError('Лобби не найдено.');
        setIsJoining(false);
        return;
      }

      // Если игра уже началась - сразу переходим в игру
      if (lobby.started_at) {
        console.log('Game already started, joining directly...');
        const { data: room } = await supabase
          .from('rooms')
          .select('*')
          .eq('lobby_id', lobby.id)
          .single();
        
        if (room) {
          setRoomId(room.id);
          setCurrentScreen('game');
          setIsJoining(false);
          return;
        }
      }

      // Проверяем, не заполнено ли лобби
      const { data: participants } = await supabase
        .from('lobby_participants')
        .select('id')
        .eq('lobby_id', lobby.id);

      if (participants && participants.length >= lobby.max_players) {
        setError('Лобби заполнено.');
        setIsJoining(false);
        return;
      }

      setCurrentLobby(lobby);
      setCurrentScreen('character-select');
    } catch (err: any) {
      setError(`Ошибка входа в лобби: ${err.message}`);
      console.error(err);
    } finally {
      setIsJoining(false);
    }
  };

  const handleCharacterSelected = (character: Character) => {
    setSelectedCharacter(character);
    setUserName(character.name);
    setCurrentScreen('lobby');
  };

  const handleStartGame = async () => {
    console.log('=== APP: HANDLE START GAME ===');
    console.log('Current lobby:', currentLobby);
    console.log('Selected character:', selectedCharacter);

    if (!currentLobby || !selectedCharacter) {
      console.error('Missing lobby or character!');
      return;
    }

    const newRoomId = currentLobby.id;
    console.log('Creating/joining room with ID:', newRoomId);

    try {
      // Очищаем старые данные комнаты из localStorage
      localStorage.removeItem(`room_stats_${newRoomId}`);
      console.log('Cleared old room stats from localStorage');

      // Проверяем, существует ли уже комната
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('*')
        .eq('lobby_id', currentLobby.id)
        .single();

      if (existingRoom) {
        // Комната уже существует (хост создал), просто присоединяемся
        console.log('Room already exists, joining...');
        saveRoomToRecent(newRoomId, selectedCharacter.name);
        setRoomId(newRoomId);
        setCurrentScreen('game');
        console.log('Switched to game screen (existing room)');
        return;
      }

      // Комнеты нет - создаем (только хост)
      console.log('Creating new room...');
      const { data, error: roomError } = await supabase.from('rooms').insert({
        id: newRoomId,
        created_by: selectedCharacter.name,
        lobby_id: currentLobby.id,
      }).select();

      if (roomError) {
        console.error('Room insert error:', roomError);
        throw roomError;
      }

      console.log('Room created:', data);

      saveRoomToRecent(newRoomId, selectedCharacter.name);
      setRoomId(newRoomId);
      setCurrentScreen('game');

      console.log('Switched to game screen');
    } catch (err: any) {
      setError(`Ошибка создания комнаты: ${err.message}`);
      console.error('Start game error:', err);
    }
  };

  const handleLeaveLobby = () => {
    setCurrentLobby(null);
    setSelectedCharacter(null);
    setCurrentScreen('menu');
  };

  if (currentScreen === 'game' && roomId) {
    return <Chat 
      roomId={roomId} 
      userName={userName} 
      character={selectedCharacter}
      onLeave={() => {
        setRoomId(null);
        setCurrentScreen('menu');
        setCurrentLobby(null);
        setSelectedCharacter(null);
      }} 
      theme={theme} 
      setTheme={handleThemeChange} 
    />;
  }

  if (currentScreen === 'character-select' && currentLobby) {
    return (
      <div className={theme}>
        <CharacterSelect
          lobbyId={currentLobby.id}
          userSessionId={userSessionId}
          onCharacterSelected={handleCharacterSelected}
          onBack={handleLeaveLobby}
        />
      </div>
    );
  }

  if (currentScreen === 'lobby' && currentLobby && selectedCharacter) {
    return (
      <div className={theme}>
        <LobbyRoom
          lobby={currentLobby}
          character={selectedCharacter}
          userSessionId={userSessionId}
          onStartGame={handleStartGame}
          onLeave={handleLeaveLobby}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 font-sans selection:bg-primary/30 ${theme}`}>
      <div className="max-w-md w-full space-y-8 relative">
        {/* Background Glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary-bg rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-zinc-900/40 rounded-full blur-[100px] pointer-events-none" />

        <div className="text-center space-y-4 relative">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex p-4 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl mb-4"
          >
            <Swords className="w-12 h-12 text-primary" />
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-5xl font-black tracking-tighter text-white"
          >
            D&D <span className="text-primary">DARK</span> FANTASY
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em]"
          >
            Кооперативный ИИ Мастер Подземелий
          </motion.p>
        </div>

        <motion.div 
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-8 rounded-[2rem] shadow-2xl space-y-6 relative overflow-hidden"
        >
          <div className="space-y-4">
            {/* Theme Selector */}
            <div className="flex justify-center gap-3 pb-2">
              {[
                { id: 'theme-emerald', color: 'bg-emerald-500' },
                { id: 'theme-crimson', color: 'bg-rose-500' },
                { id: 'theme-amethyst', color: 'bg-violet-500' },
                { id: 'theme-amber', color: 'bg-amber-500' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleThemeChange(t.id)}
                  className={`w-6 h-6 rounded-full ${t.color} transition-all ${theme === t.id ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110' : 'opacity-50 hover:opacity-100'}`}
                  title="Сменить тему"
                />
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Имя персонажа</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Введите ваше имя..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-zinc-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={createRoom}
                disabled={isJoining}
                className="group flex flex-col items-center justify-center gap-3 p-6 bg-zinc-950 border border-zinc-800 rounded-3xl hover:border-primary/50 hover:bg-zinc-900 transition-all duration-300 shadow-lg disabled:opacity-50"
              >
                <div className="p-3 bg-primary-bg rounded-2xl group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Создать лобби</span>
              </button>
              
              <div className="flex flex-col gap-2">
                <form onSubmit={joinRoom} className="h-full flex flex-col gap-2">
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="Код лобби"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 text-center text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-zinc-700"
                  />
                  <button
                    id="join-btn"
                    type="submit"
                    disabled={isJoining}
                    className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    Войти
                  </button>
                </form>
              </div>
            </div>

            {recentRooms.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Сохраненные путешествия</h3>
                <div className="grid grid-cols-1 gap-2">
                  {recentRooms.map((room) => {
                    const lastPlayedDate = room.lastPlayed ? new Date(room.lastPlayed) : null;
                    const timeAgo = lastPlayedDate ? getTimeAgo(lastPlayedDate) : '';
                    
                    return (
                      <div
                        key={room.id}
                        onClick={() => {
                          if (!userName.trim()) {
                            setError('Пожалуйста, введите ваше имя.');
                            return;
                          }
                          setRoomInput(room.id);
                          setTimeout(() => {
                             const btn = document.getElementById('join-btn');
                             btn?.click();
                          }, 10);
                        }}
                        className="flex items-center justify-between p-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl hover:border-primary/30 hover:bg-zinc-900 transition-all group relative cursor-pointer"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 bg-zinc-900 rounded-lg">
                            <ScrollText className="w-4 h-4 text-zinc-600 group-hover:text-primary transition-colors" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-zinc-300">{room.id}</span>
                            {room.characterName && (
                              <span className="text-[10px] text-zinc-600">
                                <UserIcon className="w-3 h-3 inline mr-1" />
                                {room.characterName}
                              </span>
                            )}
                            {timeAgo && (
                              <span className="text-[9px] text-zinc-700 font-mono">{timeAgo}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-zinc-600 uppercase group-hover:text-primary transition-colors">Продолжить</span>
                          <button
                            onClick={(e) => deleteRoomFromRecent(e, room.id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-zinc-700 hover:text-red-500"
                            title="Удалить из истории"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl space-y-2"
              >
                <p className="text-xs text-red-400 font-medium text-center">{error}</p>
                {error.includes('Database tables missing') && (
                  <div className="text-[10px] text-zinc-500 font-mono bg-zinc-950 p-2 rounded-lg border border-zinc-800 overflow-x-auto">
                    <p className="mb-1 text-emerald-500">Run this in Supabase SQL Editor:</p>
                    <pre className="whitespace-pre">
{`CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  character_stats JSONB
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT REFERENCES rooms(id),
  sender_id TEXT,
  sender_name TEXT,
  content TEXT,
  is_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`}
                    </pre>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-4 border-t border-zinc-800/50 grid grid-cols-3 gap-2">
            {[
              { icon: Shield, label: 'Безопасно' },
              { icon: ScrollText, label: 'Лор' },
              { icon: MapIcon, label: 'Мир' }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 opacity-40">
                <item.icon className="w-4 h-4 text-primary" />
                <span className="text-[8px] font-bold uppercase tracking-tighter text-primary">{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <div className="pt-6 border-t border-zinc-800/30">
          {/* Кнопка установки PWA */}
          <AnimatePresence>
            {showInstallPrompt && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="mb-4"
              >
                <button
                  onClick={handleInstallApp}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-hover hover:bg-primary text-white rounded-2xl text-sm font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary-glow"
                >
                  <Download className="w-4 h-4" />
                  Установить приложение
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center text-xs text-zinc-500 font-medium"
          >
            Создано с <span className="text-primary">⚔️</span> и <span className="text-primary">🌙</span>
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-center text-[10px] text-zinc-600 font-mono mt-2"
          >
            Powered by <span className="text-zinc-400">Groq API (Llama 3.1)</span> & <span className="text-zinc-400">Supabase</span>
          </motion.p>
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {roomToDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="max-w-sm w-full bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="inline-flex p-3 bg-red-500/10 border border-red-500/20 rounded-2xl mb-2">
                    <Trash2 className="w-6 h-6 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Удалить приключение?</h2>
                  <p className="text-zinc-400 text-sm">
                    Комната <span className="text-zinc-200 font-mono">{roomToDelete}</span> будет потеряна навсегда.
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={confirmFullDelete}
                    disabled={isDeleting}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Полное удаление (БД + Список)
                  </button>
                  <button
                    onClick={removeOnlyFromList}
                    disabled={isDeleting}
                    className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    Убрать только из списка
                  </button>
                  <button
                    onClick={() => setRoomToDelete(null)}
                    disabled={isDeleting}
                    className="w-full py-4 text-zinc-500 hover:text-zinc-300 text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    Отмена
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
