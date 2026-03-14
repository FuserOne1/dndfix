import { useState, useEffect } from 'react';
import Chat from './components/Chat';
import CharacterSelect from './components/CharacterSelect';
import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from './lib/supabase';
import { Character } from './types';
import { Plus, LogIn, Swords, Shield, ScrollText, Map as MapIcon, User as UserIcon, Loader2, AlertTriangle, Trash2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomInput, setRoomInput] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [recentRooms, setRecentRooms] = useState<{id: string, name: string, characterName?: string, lastPlayed?: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState('theme-emerald');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Упрощённые состояния — без лобби
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'character-select' | 'game'>('menu');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  
  const [userSessionId] = useState(() => {
    const stored = localStorage.getItem('user_session_id');
    if (stored) return stored;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('user_session_id', newId);
    return newId;
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const beforeInstallPromptEvent = e as any;
      setDeferredPrompt(beforeInstallPromptEvent);
      // Показываем кнопку установки сразу
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
      });
    } else {
      // Если нет prompt - показываем инструкцию
      alert('Чтобы установить приложение:\n\n📱 Android: Меню → "Добавить на главный экран"\n\n🍎 iOS: Кнопка "Поделиться" → "На экран «Домой»"');
    }
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
        characterName: characterName || '',
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
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', roomToDelete);

      if (msgError) throw msgError;

      const { error: roomError } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomToDelete);

      if (roomError) throw roomError;

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

  // Создание новой комнаты — сразу переход в игру
  const createRoom = async (character: Character) => {
    setIsJoining(true);
    setError(null);

    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();

    console.log('=== CREATING ROOM ===');
    console.log('Room ID:', newRoomId);
    console.log('Character:', character.name);

    try {
      localStorage.removeItem(`room_stats_${newRoomId}`);
      
      const { data, error: roomError } = await supabase.from('rooms').insert({
        id: newRoomId,
        created_by: character.name,
      }).select();

      if (roomError) throw roomError;

      console.log('Room created:', data);

      saveRoomToRecent(newRoomId, character.name);
      setRoomId(newRoomId);
      setCurrentScreen('game');
    } catch (err: any) {
      setError(`Ошибка создания комнаты: ${err.message}`);
      console.error('Create room error:', err);
    } finally {
      setIsJoining(false);
    }
  };

  // Вход в существующую комнату
  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim()) {
      setError('Пожалуйста, введите код лобби.');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomInput.toUpperCase())
        .single();

      if (roomError || !room) {
        setError('Комната не найдена.');
        setIsJoining(false);
        return;
      }

      saveRoomToRecent(room.id);
      setRoomId(room.id);
      setCurrentScreen('game');
    } catch (err: any) {
      setError(`Ошибка входа: ${err.message}`);
    } finally {
      setIsJoining(false);
    }
  };

  // Обработчик выбора персонажа — сразу создаём/входим в комнату
  const handleCharacterSelected = async (character: Character, roomId?: string) => {
    console.log('=== CHARACTER SELECTED ===');
    console.log('Character:', character);
    console.log('RoomId:', roomId);
    console.log('My userSessionId:', userSessionId);

    setSelectedCharacter(character);

    if (roomId) {
      // Присоединение к существующей комнате — сразу показываем чат
      console.log('Joining existing room with character:', character.name);
      saveRoomToRecent(roomId, character.name);
      setRoomId(roomId);
      setCurrentScreen('game');
    } else {
      // Создание новой комнаты
      console.log('Creating new room with character:', character.name);
      await createRoom(character);
    }
  };

  const handleLeaveGame = () => {
    setRoomId(null);
    setCurrentScreen('menu');
    setSelectedCharacter(null);
    setCurrentRoomId(null);
  };

  // Экран игры
  if (currentScreen === 'game' && roomId) {
    // Если нет персонажа - переходим к выбору
    if (!selectedCharacter) {
      return (
        <div className={theme}>
          <CharacterSelect
            userSessionId={userSessionId}
            onCharacterSelected={handleCharacterSelected}
            onBack={handleLeaveGame}
            roomId={roomId}
          />
        </div>
      );
    }

    return (
      <div className={theme}>
        <Chat
          roomId={roomId}
          userName={selectedCharacter?.name || ''}
          character={selectedCharacter}
          onLeave={handleLeaveGame}
          theme={theme}
          setTheme={handleThemeChange}
        />
      </div>
    );
  }

  // Экран выбора персонажа
  if (currentScreen === 'character-select') {
    return (
      <div className={theme}>
        <CharacterSelect
          userSessionId={userSessionId}
          onCharacterSelected={handleCharacterSelected}
          onBack={() => setCurrentScreen('menu')}
          roomId={currentRoomId || undefined}
        />
      </div>
    );
  }

  // Главное меню
  return (
    <div className={`min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-3 md:p-4 font-sans selection:bg-primary/30 ${theme}`}>
      <div className="max-w-md w-full space-y-4 md:space-y-8 relative">
        {/* Background Glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary-bg rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-zinc-900/40 rounded-full blur-[100px] pointer-events-none" />

        {/* Install PWA Button - Top Right - Always Visible */}
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={handleInstallApp}
          className="fixed top-4 right-4 z-50 p-2 bg-primary-hover hover:bg-primary text-white rounded-xl shadow-lg shadow-primary-glow"
          title="Установить приложение"
        >
          <Download className="w-5 h-5" />
        </motion.button>

        <div className="text-center space-y-2 md:space-y-4 relative">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex p-3 md:p-4 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl mb-2 md:mb-4"
          >
            <Swords className="w-8 h-8 md:w-12 md:h-12 text-primary" />
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-3xl md:text-5xl font-black tracking-tighter text-white"
          >
            D&D <span className="text-primary">DARK</span> FANTASY
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-[10px] md:text-sm text-zinc-500 font-medium uppercase tracking-[0.2em]"
          >
            Кооперативный ИИ Мастер Подземелий
          </motion.p>
        </div>

        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-4 md:p-8 rounded-[2rem] shadow-2xl space-y-3 md:space-y-6 relative overflow-hidden"
        >
          <div className="space-y-3 md:space-y-4">
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
              <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Код комнаты</label>
              <form onSubmit={joinRoom} className="space-y-2">
                <div className="relative">
                  <ScrollText className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-600" />
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="Введите код..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-10 md:pl-12 pr-4 py-2.5 md:py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-zinc-700 uppercase tracking-widest"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isJoining}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-widest py-2.5 md:py-4 transition-all disabled:opacity-50"
                >
                  {isJoining ? <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" /> : <LogIn className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                  Войти
                </button>
              </form>
            </div>

            <button
              onClick={() => {
                setCurrentRoomId(null);
                setCurrentScreen('character-select');
              }}
              disabled={isJoining}
              className="w-full group flex flex-col items-center justify-center gap-2 md:gap-3 p-4 md:p-6 bg-zinc-950 border border-zinc-800 rounded-3xl hover:border-primary/50 hover:bg-zinc-900 transition-all duration-300 shadow-lg disabled:opacity-50"
            >
              <div className="p-2 md:p-3 bg-primary-bg rounded-2xl group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-zinc-400">Создать новую игру</span>
            </button>
          </div>

          {/* Сохранения - снизу */}
          {recentRooms.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-800/50">
              <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Сохраненные путешествия</h3>
              <div className="grid grid-cols-1 gap-2">
                {recentRooms.map((room) => {
                  const lastPlayedDate = room.lastPlayed ? new Date(room.lastPlayed) : null;
                  const timeAgo = lastPlayedDate ? getTimeAgo(lastPlayedDate) : '';

                  return (
                    <div
                      key={room.id}
                      onClick={() => {
                        setRoomInput(room.id);
                        setTimeout(() => {
                          const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
                          btn?.click();
                        }, 10);
                      }}
                      className="flex items-center justify-between p-2 md:p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl hover:border-primary/30 hover:bg-zinc-900 transition-all group relative cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="p-1.5 bg-zinc-900 rounded-lg">
                          <ScrollText className="w-3.5 h-3.5 text-zinc-600 group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-xs font-medium text-zinc-300 truncate">{room.id}</span>
                          {room.characterName && (
                            <span className="text-[9px] text-zinc-600 truncate">
                              <UserIcon className="w-2.5 h-2.5 inline mr-1" />
                              {room.characterName}
                            </span>
                          )}
                          {timeAgo && (
                            <span className="text-[8px] text-zinc-700 font-mono">{timeAgo}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteRoomFromRecent(e, room.id)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-zinc-700 hover:text-red-500 shrink-0"
                        title="Удалить из истории"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl space-y-2"
              >
                <p className="text-xs text-red-400 font-medium text-center">{error}</p>
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
            Coded by <span className="text-primary">fuserone1</span>
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-center text-[10px] text-zinc-600 font-mono mt-2"
          >
            Powered by <span className="text-zinc-400">Claude 3.5</span>, <span className="text-zinc-400">Gemini 2.5</span> & <span className="text-zinc-400">River Flow</span>
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
"// rebuild trigger"  
"// rebuild"  
