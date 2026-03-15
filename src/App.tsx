import { useState, useEffect } from 'react';
import Chat from './components/Chat';
import CharacterSelect from './components/CharacterSelect';
import LobbyRoom from './components/LobbyRoom';
import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from './lib/supabase';
import { Character, Lobby, GameSession } from './types';
import { Plus, LogIn, Swords, Shield, ScrollText, Map as MapIcon, User as UserIcon, Loader2, AlertTriangle, Trash2, Download, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInput, setSessionInput] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<{id: string, name: string, characterName?: string, lastPlayed?: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState('theme-emerald');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Состояния экранов
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'character-select' | 'game'>('menu');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

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
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Обработка sessionId из URL при загрузке
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionFromUrl = params.get('session');

    if (sessionFromUrl) {
      console.log('=== SESSION FROM URL ===');
      console.log('Session ID:', sessionFromUrl);

      // Проверяем сессию в БД и загружаем персонажа
      supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionFromUrl)
        .single()
        .then(async ({ data: session, error }) => {
          if (!error && session) {
            setSessionId(sessionFromUrl);
            
            // Загружаем моего персонажа из участников
            const { data: participants } = await supabase
              .from('game_session_participants')
              .select('character_id, character(*)')
              .eq('session_id', sessionFromUrl)
              .eq('user_session_id', userSessionId);
            
            if (participants && participants.length > 0 && participants[0].character) {
              const myCharacter = participants[0].character as Character;
              
              // Если в сессии есть character_stats - используем их
              if (session.character_stats?.[myCharacter.name]) {
                const sessionStats = session.character_stats[myCharacter.name];
                const characterWithStats: Character = {
                  ...myCharacter,
                  hp_current: sessionStats.hp?.current || myCharacter.hp_current,
                  hp_max: sessionStats.hp?.max || myCharacter.hp_max,
                  level: sessionStats.level || myCharacter.level,
                  xp: sessionStats.xp || myCharacter.xp,
                  strength: sessionStats.stats?.strength || myCharacter.strength,
                  dexterity: sessionStats.stats?.dexterity || myCharacter.dexterity,
                  constitution: sessionStats.stats?.constitution || myCharacter.constitution,
                  intelligence: sessionStats.stats?.intelligence || myCharacter.intelligence,
                  wisdom: sessionStats.stats?.wisdom || myCharacter.wisdom,
                  charisma: sessionStats.stats?.charisma || myCharacter.charisma,
                  equipment: sessionStats.equipment || myCharacter.equipment,
                  story_summary: sessionStats.story_summary || myCharacter.story_summary,
                };
                setSelectedCharacter(characterWithStats);
                console.log('✅ Loaded character with stats from URL session:', myCharacter.name);
              } else {
                setSelectedCharacter(myCharacter);
              }
            }
            
            setCurrentScreen('game');
            // Очищаем URL
            window.history.replaceState({}, '', window.location.pathname);
          }
        });
    }
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
      alert('Чтобы установить приложение:\n\n📱 Android: Меню → "Добавить на главный экран"\n\n🍎 iOS: Кнопка "Поделиться" → "На экран «Домой»"');
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('recent_sessions');
    if (saved) {
      try {
        setRecentSessions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent sessions', e);
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

  const saveSessionToRecent = (id: string, characterName?: string) => {
    const newRecent = [
      {
        id,
        name: `Adventure ${id}`,
        characterName: characterName || '',
        lastPlayed: new Date().toISOString()
      },
      ...recentSessions.filter(r => r.id !== id)
    ].slice(0, 5);
    setRecentSessions(newRecent);
    localStorage.setItem('recent_sessions', JSON.stringify(newRecent));
  };

  const removeOnlyFromList = () => {
    if (!sessionToDelete) return;
    const newRecent = recentSessions.filter(r => r.id !== sessionToDelete);
    setRecentSessions(newRecent);
    localStorage.setItem('recent_sessions', JSON.stringify(newRecent));
    setSessionToDelete(null);
  };

  const confirmFullDelete = async () => {
    if (!sessionToDelete) return;

    setIsDeleting(true);
    try {
      // Удаляем сообщения
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('session_id', sessionToDelete);

      if (msgError) throw msgError;

      // Удаляем участников сессии
      const { error: partError } = await supabase
        .from('game_session_participants')
        .delete()
        .eq('session_id', sessionToDelete);

      if (partError) throw partError;

      // Удаляем сессию
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .delete()
        .eq('id', sessionToDelete);

      if (sessionError) throw sessionError;

      const newRecent = recentSessions.filter(r => r.id !== sessionToDelete);
      setRecentSessions(newRecent);
      localStorage.setItem('recent_sessions', JSON.stringify(newRecent));

      setSessionToDelete(null);
    } catch (err: any) {
      setError(`Failed to delete session: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
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

  // Создание новой сессии
  const createSession = async (character: Character) => {
    setIsJoining(true);
    setError(null);

    const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();

    console.log('=== CREATING SESSION ===');
    console.log('Session ID:', newSessionId);
    console.log('Character:', character.name);

    try {
      localStorage.removeItem(`session_stats_${newSessionId}`);

      const { data, error: sessionError } = await supabase.from('game_sessions').insert({
        id: newSessionId,
        created_by: character.name,
      }).select();

      if (sessionError) throw sessionError;

      console.log('Session created:', data);

      // Добавляем текущего игрока как участника
      await supabase.from('game_session_participants').insert({
        session_id: newSessionId,
        character_id: character.id,
        user_session_id: userSessionId,
      });

      saveSessionToRecent(newSessionId, character.name);
      setSessionId(newSessionId);
      setCurrentScreen('game');
    } catch (err: any) {
      setError(`Ошибка создания сессии: ${err.message}`);
      console.error('Create session error:', err);
    } finally {
      setIsJoining(false);
    }
  };

  // Вход в существующую сессию
  const joinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionInput.trim()) {
      setError('Пожалуйста, введите код сессии.');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionInput.toUpperCase())
        .single();

      if (sessionError || !session) {
        setError('Сессия не найдена.');
        setIsJoining(false);
        return;
      }

      // Загружаем участников сессии и находим моего персонажа
      const { data: participants } = await supabase
        .from('game_session_participants')
        .select('character_id, character(*)')
        .eq('session_id', session.id)
        .eq('user_session_id', userSessionId);

      if (participants && participants.length > 0 && participants[0].character) {
        // Нашли моего персонажа - загружаем актуальные статы из сессии
        const myCharacter = participants[0].character as Character;
        
        // Если в сессии есть character_stats - используем их
        if (session.character_stats?.[myCharacter.name]) {
          const sessionStats = session.character_stats[myCharacter.name];
          const characterWithStats: Character = {
            ...myCharacter,
            hp_current: sessionStats.hp?.current || myCharacter.hp_current,
            hp_max: sessionStats.hp?.max || myCharacter.hp_max,
            level: sessionStats.level || myCharacter.level,
            xp: sessionStats.xp || myCharacter.xp,
            strength: sessionStats.stats?.strength || myCharacter.strength,
            dexterity: sessionStats.stats?.dexterity || myCharacter.dexterity,
            constitution: sessionStats.stats?.constitution || myCharacter.constitution,
            intelligence: sessionStats.stats?.intelligence || myCharacter.intelligence,
            wisdom: sessionStats.stats?.wisdom || myCharacter.wisdom,
            charisma: sessionStats.stats?.charisma || myCharacter.charisma,
            equipment: sessionStats.equipment || myCharacter.equipment,
            story_summary: sessionStats.story_summary || myCharacter.story_summary,
          };
          setSelectedCharacter(characterWithStats);
          console.log('✅ Loaded character with stats from session:', myCharacter.name);
        } else {
          setSelectedCharacter(myCharacter);
        }
      }

      saveSessionToRecent(session.id);
      setSessionId(session.id);
      setCurrentScreen('game');
    } catch (err: any) {
      setError(`Ошибка входа: ${err.message}`);
    } finally {
      setIsJoining(false);
    }
  };

  // Обработчик выбора персонажа
  const handleCharacterSelected = async (character: Character, sessionId?: string) => {
    console.log('=== CHARACTER SELECTED ===');
    console.log('Character:', character);
    console.log('SessionId:', sessionId);
    console.log('My userSessionId:', userSessionId);

    setSelectedCharacter(character);

    if (sessionId) {
      // Присоединение к существующей сессии
      console.log('Joining session with character:', character.name);

      // Добавляем участника в сессию
      await supabase.from('game_session_participants').insert({
        session_id: sessionId,
        character_id: character.id,
        user_session_id: userSessionId,
      });

      // Инициализируем character_stats для этого персонажа
      const characterStatsData = {
        [character.name]: {
          name: character.name,
          race: character.race,
          class: character.class,
          level: character.level,
          hp: { current: character.hp_current, max: character.hp_max },
          xp: character.xp,
          stats: {
            strength: character.strength,
            dexterity: character.dexterity,
            constitution: character.constitution,
            intelligence: character.intelligence,
            wisdom: character.wisdom,
            charisma: character.charisma,
          },
          background: character.background,
          equipment: character.equipment,
          story_summary: character.story_summary,
        }
      };

      await supabase.from('game_sessions')
        .update({ 
          character_stats: characterStatsData 
        })
        .eq('id', sessionId);

      // Переход в игру
      setSessionId(sessionId);
      setCurrentScreen('game');
    } else {
      // Создание новой сессии (уже создана, просто переходим в игру)
      console.log('Starting new session with character:', character.name);
      
      // Добавляем участника в сессию
      await supabase.from('game_session_participants').insert({
        session_id: sessionId || currentRoomId,
        character_id: character.id,
        user_session_id: userSessionId,
      });

      // Инициализируем character_stats
      const characterStatsData = {
        [character.name]: {
          name: character.name,
          race: character.race,
          class: character.class,
          level: character.level,
          hp: { current: character.hp_current, max: character.hp_max },
          xp: character.xp,
          stats: {
            strength: character.strength,
            dexterity: character.dexterity,
            constitution: character.constitution,
            intelligence: character.intelligence,
            wisdom: character.wisdom,
            charisma: character.charisma,
          },
          background: character.background,
          equipment: character.equipment,
          story_summary: character.story_summary,
        }
      };

      await supabase.from('game_sessions')
        .update({ 
          character_stats: characterStatsData 
        })
        .eq('id', sessionId || currentRoomId);

      setCurrentScreen('game');
    }
  };

  const handleLeaveGame = () => {
    setSessionId(null);
    setCurrentScreen('menu');
    setSelectedCharacter(null);
  };

  const handleCreateLobby = async () => {
    // Создаём сессию напрямую без лобби
    console.log('=== CREATING SESSION DIRECTLY ===');
    setIsJoining(true);
    setError(null);

    try {
      const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      console.log('Generated session code:', sessionCode);

      const { data, error } = await supabase.from('game_sessions').insert({
        id: sessionCode,
        created_by: userSessionId,
        character_stats: {}, // Инициализируем пустыми статами
        is_ai_generating: false,
      }).select();

      if (error) {
        console.error('Session creation error:', error);
        throw error;
      }

      console.log('Session created:', data);

      // Сохраняем сессию и переходим к выбору персонажа
      setSessionId(sessionCode);
      saveSessionToRecent(sessionCode);
      setCurrentScreen('character-select');
    } catch (err: any) {
      console.error('Create session error:', err);
      setError(`Ошибка создания сессии: ${err.message}`);
    } finally {
      setIsJoining(false);
    }
  };

  // Экран игры
  if (currentScreen === 'game' && sessionId) {
    if (!selectedCharacter) {
      return (
        <div className={theme}>
          <CharacterSelect
            userSessionId={userSessionId}
            onCharacterSelected={handleCharacterSelected}
            onBack={handleLeaveGame}
            roomId={sessionId}
          />
        </div>
      );
    }

    return (
      <div className={theme}>
        <Chat
          sessionId={sessionId}
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
          roomId={sessionId || undefined}
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

        {/* Install PWA Button */}
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
          <div className="space-y-2 md:space-y-4">
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

            {/* Ввод кода сессии */}
            <div className="space-y-2">
              <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Код сессии</label>
              <form onSubmit={joinSession} className="space-y-2">
                <div className="relative">
                  <ScrollText className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-600" />
                  <input
                    type="text"
                    value={sessionInput}
                    onChange={(e) => setSessionInput(e.target.value)}
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

            {/* Создать сессию */}
            <button
              onClick={handleCreateLobby}
              disabled={isJoining}
              className="w-full group flex flex-col items-center justify-center gap-2 md:gap-3 p-4 md:p-6 bg-zinc-950 border border-zinc-800 rounded-3xl hover:border-primary/50 hover:bg-zinc-900 transition-all duration-300 shadow-lg disabled:opacity-50"
            >
              <div className="p-2 md:p-3 bg-primary-bg rounded-2xl group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-zinc-400">Создать сессию</span>
            </button>

            {/* Одиночная игра */}
            <button
              onClick={() => {
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

          {/* Сохранения */}
          {recentSessions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-800/50">
              <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Сохраненные путешествия</h3>
              <div className="grid grid-cols-1 gap-2">
                {recentSessions.map((session) => {
                  const lastPlayedDate = session.lastPlayed ? new Date(session.lastPlayed) : null;
                  const timeAgo = lastPlayedDate ? getTimeAgo(lastPlayedDate) : '';

                  return (
                    <div
                      key={session.id}
                      onClick={() => {
                        setSessionInput(session.id);
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
                          <span className="text-xs font-medium text-zinc-300 truncate">{session.id}</span>
                          {session.characterName && (
                            <span className="text-[9px] text-zinc-600 truncate">
                              <UserIcon className="w-2.5 h-2.5 inline mr-1" />
                              {session.characterName}
                            </span>
                          )}
                          {timeAgo && (
                            <span className="text-[8px] text-zinc-700 font-mono">{timeAgo}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDelete(session.id);
                        }}
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
          {sessionToDelete && (
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
                    Сессия <span className="text-zinc-200 font-mono">{sessionToDelete}</span> будет потеряна навсегда.
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
                    onClick={() => setSessionToDelete(null)}
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
