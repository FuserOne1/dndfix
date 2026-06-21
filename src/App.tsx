import { useState, useEffect, useMemo } from 'react';
import Chat from './components/Chat';
import CharacterSelect from './components/CharacterSelect';
import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from './lib/supabase';
import { Character } from './types';
import { LogIn, Swords, ScrollText, User as UserIcon, Loader2, AlertTriangle, Trash2, Download, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInput, setSessionInput] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recentSessions, setRecentSessions] = useState<{id: string, name: string, characterName?: string, lastPlayed?: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState('theme-emerald');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'character-select' | 'game'>('menu');
  const [showVersionInfo, setShowVersionInfo] = useState(false);
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

  // Обработка sessionId из URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionFromUrl = params.get('session');
    if (sessionFromUrl) {
      console.log('=== SESSION FROM URL ===');
      console.log('Session ID:', sessionFromUrl);
      loadSessionWithStats(sessionFromUrl);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadSessionWithStats = async (sessionId: string) => {
    try {
      const { data: session, error } = await supabase
        .from('game_sessions')
        .select('id')
        .eq('id', sessionId)
        .single();
      
      if (!error && session) {
        setSessionId(sessionId);
        // character_stats больше не используем - статы загружаются из characters напрямую
        setCurrentScreen('game');
      }
    } catch (err) {
      console.error('Error loading session:', err);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('recent_sessions');
    if (saved) {
      try { setRecentSessions(JSON.parse(saved)); } catch (e) { console.error('Failed to parse recent sessions', e); }
    }
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme) { setTheme(savedTheme); }
  }, []);

  const handleThemeChange = (newTheme: string) => { setTheme(newTheme); localStorage.setItem('app_theme', newTheme); };

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
    const newRecent = [{ id, name: `Adventure ${id}`, characterName: characterName || '', lastPlayed: new Date().toISOString }, ...recentSessions.filter(r => r.id !== id)].slice(0, 5);
    setRecentSessions(newRecent);
    localStorage.setItem('recent_sessions', JSON.stringify(newRecent));
  };

  const confirmFullDelete = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      await supabase.from('messages').delete().eq('session_id', sessionToDelete);
      await supabase.from('game_sessions').delete().eq('id', sessionToDelete);
      const newRecent = recentSessions.filter(r => r.id !== sessionToDelete);
      setRecentSessions(newRecent);
      localStorage.setItem('recent_sessions', JSON.stringify(newRecent));
      setSessionToDelete(null);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      setError(`Failed to delete session: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setShowDeleteConfirm(true);
  };

  const isPlaceholder = supabaseUrl.includes('your-project-id') || supabaseAnonKey === 'your-anon-key';
  if (!isSupabaseConfigured || isPlaceholder) {
    return (<div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 font-sans"><div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-[2rem] shadow-2xl space-y-6 text-center"><div className="inline-flex p-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl mb-4"><AlertTriangle className="w-12 h-12 text-amber-500" /></div><h1 className="text-2xl font-bold text-white">Configuration Required</h1><p className="text-zinc-400 text-sm leading-relaxed">Please set your <b>real</b> Supabase credentials in the <b>Secrets</b> panel:</p><div className="bg-zinc-950 p-4 rounded-xl text-left font-mono text-xs space-y-2 border border-zinc-800"><p className="text-emerald-500">VITE_SUPABASE_URL</p><p className="text-emerald-500">VITE_SUPABASE_ANON_KEY</p></div></div></div>);
  }

  const createSession = async (character: Character) => {
    setIsJoining(true);
    setError(null);
    const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log('=== CREATING SESSION ===');
    console.log('Session ID:', newSessionId);
    console.log('Character:', character.name);
    try {
      const { data, error: sessionError } = await supabase.from('game_sessions').insert({
        id: newSessionId,
        created_by: character.name,
      }).select();
      if (sessionError) throw sessionError;
      console.log('Session created:', data);
      saveSessionToRecent(newSessionId, character.name);
      setSessionId(newSessionId);
      setSelectedCharacter(character);
      setCurrentScreen('game');
    } catch (err: any) { setError(`Ошибка создания сессии: ${err.message}`); console.error('Create session error:', err); }
    finally { setIsJoining(false); }
  };

  const joinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionInput.trim()) { setError('Пожалуйста, введите код сессии.'); return; }
    setIsJoining(true);
    setError(null);
    try {
      console.log('🔍 joinSession: input =', sessionInput.toUpperCase());
      await loadSessionWithStats(sessionInput.toUpperCase());
      saveSessionToRecent(sessionInput.toUpperCase());
    } catch (err: any) {
      console.error('❌ joinSession error:', err);
      setError(`Ошибка входа: ${err.message}`);
    } finally {
      setIsJoining(false);
    }
  };

  const handleCharacterSelected = async (character: Character, sessionId?: string) => {
    console.log('=== CHARACTER SELECTED ===');
    console.log('Character:', character);
    console.log('SessionId:', sessionId);
    setSelectedCharacter(character);
    
    if (sessionId) {
      console.log('Joining session with character:', character.name);
      setSessionId(sessionId);
      setCurrentScreen('game');
    }
  };

  const handleLeaveGame = () => { setSessionId(null); setCurrentScreen('menu'); setSelectedCharacter(null); };

  const handleCreateLobby = async () => {
    console.log('=== CREATING SESSION DIRECTLY ===');
    setIsJoining(true);
    setError(null);
    try {
      const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      console.log('Generated session code:', sessionCode);
      const { data, error } = await supabase.from('game_sessions').insert({
        id: sessionCode,
        created_by: userSessionId,
      }).select();
      if (error) { console.error('Session creation error:', error); throw error; }
      console.log('Session created:', data);
      setSessionId(sessionCode);
      saveSessionToRecent(sessionCode);
      setCurrentScreen('character-select');
    } catch (err: any) { console.error('Create session error:', err); setError(`Ошибка создания сессии: ${err.message}`); }
    finally { setIsJoining(false); }
  };

  const handleInstallApp = () => {
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then((choiceResult: any) => { if (choiceResult.outcome === 'accepted') { console.log('User accepted the install prompt'); } setDeferredPrompt(null); setShowInstallPrompt(false); }); }
    else { alert('Чтобы установить приложение:\n\n📱 Android: Меню → "Добавить на главный экран"\n\n🍎 iOS: Кнопка "Поделиться" → "На экран «Домой»"'); }
  };

  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      x: Math.random() * 100,
      y: -(Math.random() * 20 + 10),
      size: Math.random() * 5 + 2,
      duration: Math.random() * 10 + 14,
      delay: Math.random() * 12,
      animClass: i % 3 === 0 ? 'animate-float-up' : i % 3 === 1 ? 'animate-float-up-2' : 'animate-float-up-3',
    })), []
  );

  if (currentScreen === 'game' && sessionId) {
    if (!selectedCharacter) { return (<div className={theme}><CharacterSelect userSessionId={userSessionId} onCharacterSelected={handleCharacterSelected} onBack={handleLeaveGame} roomId={sessionId} /></div>); }
    return (<div className={theme}><Chat sessionId={sessionId} userName={selectedCharacter?.name || ''} character={selectedCharacter} onLeave={handleLeaveGame} theme={theme} setTheme={handleThemeChange} /></div>);
  }

  if (currentScreen === 'character-select') { return (<div className={theme}><CharacterSelect userSessionId={userSessionId} onCharacterSelected={handleCharacterSelected} onBack={() => setCurrentScreen('menu')} roomId={sessionId || undefined} /></div>); }

  return (
    <div className={`min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-3 md:p-4 font-sans selection:bg-primary/30 overflow-hidden ${theme}`}>
      {/* ═══ Тёмный фон с партиклами ═══ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {particles.map((p, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${p.animClass}`}
            style={{
              left: `${p.x}%`,
              bottom: `${p.y}px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: i % 4 === 0 ? 'var(--theme-primary)' : i % 4 === 1 ? '#fbbf24' : '#a1a1aa',
              opacity: 0.15 + p.size * 0.06,
              boxShadow: i % 4 === 0 ? '0 0 6px 2px var(--theme-primary-glow)' : 'none',
              '--dur': `${p.duration}s`,
              '--delay': `${p.delay}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ═══ Пульсирующее свечение ═══ */}
      <div className="fixed -top-40 -left-40 w-[500px] h-[500px] animate-pulse-glow rounded-full pointer-events-none z-0"
        style={{ background: 'var(--theme-primary)', opacity: 0.08 }} />
      <div className="fixed -bottom-40 -right-40 w-[500px] h-[500px] animate-pulse-glow rounded-full pointer-events-none z-0"
        style={{ background: 'var(--theme-primary)', opacity: 0.06, animationDelay: '2.5s' }} />

      {/* ═══ Install button ═══ */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleInstallApp}
        className="fixed top-4 right-4 z-50 p-2.5 bg-zinc-900/80 backdrop-blur border border-zinc-800 hover:border-primary/50 text-zinc-400 hover:text-primary rounded-xl shadow-lg transition-colors"
        title="Установить приложение"
      >
        <Download className="w-4 h-4" />
      </motion.button>

      {/* ═══ Основной контент ═══ */}
      <div className="max-w-md w-full space-y-4 md:space-y-8 relative z-10">

        {/* ═══ Рунический круг + заголовок ═══ */}
        <div className="text-center space-y-3 md:space-y-4 relative">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="flex justify-center mb-2"
          >
            <svg viewBox="0 0 200 200" className="w-36 h-36 md:w-52 md:h-52 text-primary/25">
              <defs>
                <radialGradient id="rune-grad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--theme-primary)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="var(--theme-primary)" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="100" cy="100" r="95" fill="url(#rune-grad)" />
              <g className="animate-spin-slow" style={{ transformOrigin: '100px 100px' }}>
                <circle cx="100" cy="100" r="85" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
                <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.15" strokeDasharray="3 6" />
              </g>
              <g className="animate-spin-reverse" style={{ transformOrigin: '100px 100px' }}>
                <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" strokeDasharray="2 8" />
              </g>
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => {
                const rad = (angle * Math.PI) / 180;
                const x1 = 100 + 76 * Math.cos(rad);
                const y1 = 100 + 76 * Math.sin(rad);
                const x2 = 100 + 90 * Math.cos(rad);
                const y2 = 100 + 90 * Math.sin(rad);
                return (
                  <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="currentColor" strokeWidth="1"
                    className="animate-rune-glow"
                    style={{ animationDelay: `${(angle / 360) * 3}s`, opacity: 0.2 }}
                  />
                );
              })}
              {/* Ромб в центре */}
              <polygon points="100,85 115,100 100,115 85,100"
                fill="none" stroke="currentColor" strokeWidth="1"
                className="animate-rune-glow" style={{ animationDelay: '0.5s' }} />
              <circle cx="100" cy="100" r="2" fill="currentColor" opacity="0.4" />
            </svg>
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-4xl md:text-6xl font-black tracking-tighter text-white leading-none"
          >
            D&amp;D
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-xl md:text-3xl font-black tracking-[0.15em] animate-title-glow"
            style={{ color: 'var(--theme-primary)' }}
          >
            DARK FANTASY
          </motion.p>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="text-[9px] md:text-xs text-zinc-600 font-bold uppercase tracking-[0.3em]"
          >
            Кооперативный ИИ-Мастер
          </motion.p>
        </div>

        {/* ═══ Карточка с действиями ═══ */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6, ease: 'easeOut' }}
          className="bg-zinc-900/40 backdrop-blur-2xl border border-zinc-800/60 p-4 md:p-6 rounded-[1.75rem] shadow-2xl space-y-3 md:space-y-4 relative overflow-hidden"
        >
          {/* Строка тем */}
          <div className="flex justify-center gap-2.5 pb-1">
            {[
              { id: 'theme-emerald', color: 'bg-emerald-500' },
              { id: 'theme-crimson', color: 'bg-rose-500' },
              { id: 'theme-amethyst', color: 'bg-violet-500' },
              { id: 'theme-amber', color: 'bg-amber-500' },
            ].map((t) => (
              <motion.button
                key={t.id}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.8 }}
                onClick={() => handleThemeChange(t.id)}
                className={`w-5 h-5 md:w-6 md:h-6 rounded-full ${t.color} transition-all ${
                  theme === t.id
                    ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-zinc-950 scale-110'
                    : 'opacity-40 hover:opacity-80'
                }`}
                title={t.id.replace('theme-', '')}
              />
            ))}
          </div>

          {/* Ввод кода сессии */}
          <form onSubmit={joinSession} className="space-y-2">
            <div className="relative">
              <ScrollText className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input
                type="text"
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                placeholder="Код сессии..."
                className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl pl-10 md:pl-12 pr-4 py-3 md:py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all placeholder:text-zinc-700 uppercase tracking-widest"
              />
            </div>
            <motion.button
              type="submit"
              disabled={isJoining}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 bg-zinc-800/80 hover:bg-zinc-700/80 text-white rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest py-3 md:py-3.5 transition-all disabled:opacity-50 border border-zinc-700/50"
            >
              {isJoining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              Войти
            </motion.button>
          </form>

          {/* Кнопки действий */}
          <motion.button
            onClick={handleCreateLobby}
            disabled={isJoining}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full flex flex-col items-center justify-center gap-2 p-4 md:p-5 bg-zinc-950/60 border border-zinc-800/50 rounded-2xl hover:border-primary/40 hover:bg-zinc-900/60 transition-all disabled:opacity-50 group relative overflow-hidden"
          >
            {/* Subtle hover glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary-bg/0 group-hover:from-primary-bg/10 to-transparent transition-all duration-500 pointer-events-none" />
            <div className="relative z-10 p-2.5 bg-primary-bg rounded-xl group-hover:scale-110 transition-transform">
              <Swords className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
            <span className="relative z-10 text-[10px] md:text-xs font-bold uppercase tracking-widest text-zinc-500">Новое приключение</span>
          </motion.button>

          {/* Сохраненные сессии */}
          {recentSessions.length > 0 && (
            <div className="space-y-1.5 pt-1.5 border-t border-zinc-800/40">
              <p className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-zinc-600 ml-0.5">Сохранённые</p>
              <div className="grid grid-cols-1 gap-1.5">
                {recentSessions.map((session) => {
                  const lastPlayedDate = session.lastPlayed ? new Date(session.lastPlayed) : null;
                  const timeAgo = lastPlayedDate ? getTimeAgo(lastPlayedDate) : '';
                  return (
                    <div key={session.id}
                      onClick={() => { setSessionInput(session.id); setTimeout(() => { const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement; btn?.click(); }, 10); }}
                      className="flex items-center justify-between p-2 md:p-2.5 bg-zinc-950/40 border border-zinc-800/40 rounded-xl hover:border-primary/30 hover:bg-zinc-900/50 transition-all group relative cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="p-1 bg-zinc-900 rounded-lg">
                          <ScrollText className="w-3 h-3 text-zinc-600 group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-[11px] font-medium text-zinc-400 truncate">{session.id}</span>
                          {session.characterName && (
                            <span className="text-[8px] text-zinc-600 truncate">
                              <UserIcon className="w-2 h-2 inline mr-0.5" />{session.characterName}
                            </span>
                          )}
                          {timeAgo && <span className="text-[7px] text-zinc-700 font-mono">{timeAgo}</span>}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(session.id); }}
                        className="p-1 hover:bg-red-500/10 rounded-lg transition-colors text-zinc-700 hover:text-red-500 shrink-0"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ошибки */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl"
              >
                <p className="text-[11px] text-red-400 font-medium text-center">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ═══ Модалка удаления ═══ */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-xl"><Trash2 className="w-5 h-5 text-red-400" /></div>
                  <h3 className="text-lg font-bold text-white">Удалить сессию?</h3>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Сессия <span className="text-zinc-300 font-mono">{sessionToDelete}</span> будет удалена навсегда. Это действие нельзя отменить.
                </p>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowDeleteConfirm(false); setSessionToDelete(null); }} disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                  >
                    Отмена
                  </button>
                  <button onClick={confirmFullDelete} disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center"
                  >
                    {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Удалить'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Version info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-center space-y-2"
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-[9px] text-zinc-600/80 font-mono tracking-wide">
              D&amp;D Dark Fantasy © {new Date().getFullYear()}
            </span>
          </div>
          <button
            onClick={() => setShowVersionInfo(!showVersionInfo)}
            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/40 border border-zinc-800/40 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all"
          >
            <Info className="w-2.5 h-2.5 text-zinc-500 group-hover:text-primary transition-colors" />
            <span className="text-[8px] font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors tracking-wider uppercase">
              v0.2.0 — Battle Update · 163 commits · 21 Jun 2026
            </span>
          </button>
          <AnimatePresence>
            {showVersionInfo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60 text-left space-y-2 text-[9px] font-mono leading-relaxed">
                  <p className="text-primary font-bold tracking-wider uppercase text-[8px]">v0.2.0 — Battle Update</p>
                  <p className="text-zinc-400">Полноценная боевая мини-игра с пошаговой системой D&D 5e. Заменила текстовые бои.</p>
                  <div className="space-y-0.5 text-zinc-500">
                    <p className="text-zinc-600 font-bold text-[8px] uppercase tracking-wider">Что добавлено:</p>
                    <p>• ⚔️ Пошаговая боевая система (атака, защита, заклинания, предметы)</p>
                    <p>• 🎒 Инвентарь в бою — предметы с эффектами (хил, баффы, урон)</p>
                    <p>• 🎯 Основное + бонусное действие за ход</p>
                    <p>• 👥 Враги с D&D 5e характеристиками (AC, toHit, инициатива)</p>
                    <p>• 📜 Лог боя с группировкой по раундам</p>
                    <p>• 🏆 Автоматическое применение наград (XP, лут, HP)</p>
                    <p>• 🎨 Полный редизайн интерфейса (тёмное фэнтези)</p>
                    <p>• 🖼️ Генерация изображений (OpenAI/OpenRouter)</p>
                    <p>• 👥 Мультиплеер (Supabase real-time)</p>
                  </div>
                  <div className="pt-1 border-t border-zinc-800/40 text-zinc-600">
                    <span className="text-[7px]">163 commits · last updated 21 Jun 2026 · </span>
                    <a href="https://github.com/FuserOne1/dndfix" target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary underline">GitHub</a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
