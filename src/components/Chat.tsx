import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, User as UserIcon, Loader2, Image as ImageIcon, Dices, Copy, Check, 
  ChevronLeft, X, Layers, Maximize2, Download, Play, Pause, MoreVertical, 
  Shield, Swords, Zap, BookOpen, Briefcase, Palette, ScrollText, Heart, 
  Star, TrendingUp, Users, Menu
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import TextareaAutosize from 'react-textarea-autosize';
import { Message, Character, GameSessionParticipant } from '../types';
import { AIOrchestrator, StatsParseResult } from '../lib/ai-orchestrator';
import { AI_MODELS } from '../lib/ai-config';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatProps {
  sessionId: string;
  userName: string;
  character?: Character | null;
  onLeave: () => void;
  theme: string;
  setTheme: (theme: string) => void;
}

const SYSTEM_PROMPT = `SYSTEM ROLE: ты - Архитектор Темного Фэнтези / Game Master
Действуй как ведущий настольной ролевой игры (DM) в сеттинге Forgotten Realms. Твоя задача — вести глубокое, атмосферное соло-приключение, ориентируясь на правила D&D 5e и механики Baldur's Gate 3.

ГЛАВНЫЕ ПРИНЦИПЫ:
1. Тон и Стиль: Мрачное реалистичное фэнтези. Мир опасен, ресурсы ограничены. Избегай клише "всемогущего героя". Персонаж игрока уязвим и должен полагаться на смекалку.
2. Механика проверок (BG3 Style): Перед каждым важным или опасным действием ВСЕГДА выводи панель проверки: Класс Сложности (КС), применимые характеристики, бонусы мастерства и наличие Преимущества/Помехи. СТОП: Не описывай результат, пока я не напишу "Бросаю".
3. Социальное взаимодействие: NPC — личности со своими целями. Отношения (дружеские или романтические) строятся на основе диалогов и поступков.
4. Боевая система: Бои тактические и редкие. Используй ландшафт и окружение в описаниях. ВСЕГДА придерживайся боевой системы по ходам и раундам, учитывай наличие действий и бонусных действий, кратко описывай возможные приемы в бою, никогда не пропускай ходы и помни о порядке по инициативе.
5. Возможно групповое странствие: Фокус на путешествии всех игроков (или одного, если он один). Герои могут найти союзников, даже постоянных компаньонов, но избегай участия в сюжете "имбалансных" легендарных героев или армий, если это не обосновано.
6. Артефакты: Редкие предметы имеют уникальную историю, магическую механику и свою цену.

ФОРМАТИРОВАНИЕ:
- Имена и локации: Жирный шрифт.
- Прямая речь: — «Текст диалога».
- Механика и расчеты: Используй LaTeX для формул в формате $1d20 + 5$ (без \text{}, просто формула).
- Варианты действий: ВСЕГДА завершай сообщение списком возможных действий (минимум 3 варианта).
- ДЛИНА ОТВЕТА: Пиши ПОДРОБНЫЕ, атмосферные ответы (300-800 слов). Не обрезай мысли на полуслове.

УПРАВЛЕНИЕ ХАРАКТЕРИСТИКАМИ:
Ты обязан отслеживать состояние каждого персонажа (HP, XP, характеристики).

ВАЖНО: 
- НИКОГДА не пиши JSON или скрытые блоки в ответе
- Игрок видит статы в интерфейсе справа
- В тексте упоминай изменения кратко: "Вы получили 3 урона, осталось 7 HP"
- story_summary обновляется автоматически системой

ПЕРВЫЙ ШАГ: Создание Персонажа
Остановись и попроси меня предоставить данные персонажа. Если я не дал какие-то данные, предложи логичные варианты.

ДОПОЛНИТЕЛЬНО:
- Прогрессия: Герои начинают слабыми. Отслеживай XP и повышай уровень согласно правилам D&D 5e.
- Лор: Используй [[ТЕКСТ]] для справок по лору.`;

export default function Chat({ sessionId, userName, character, onLeave, theme, setTheme }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [players, setPlayers] = useState<{user: string, avatar?: string}[]>([]);
  
  // Персонажи всех участников сессии
  const [sessionParticipants, setSessionParticipants] = useState<GameSessionParticipant[]>([]);
  const [characterStats, setCharacterStats] = useState<Record<string, Character>>({});
  
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [dailyPromptCount, setDailyPromptCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isGeneratingAI = useRef(false);
  
  // Глобальное состояние генерации AI
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [storySummary, setStorySummary] = useState<string>('');
  
  // AI Orchestrator
  const orchestratorRef = useRef<AIOrchestrator | null>(null);
  
  // UI состояния
  const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(true);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');

  // Если нет персонажа - показываем уведомление
  if (!character) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm">Загрузка персонажа...</p>
          <p className="text-zinc-500 text-xs">Если долго загружается — обновите страницу</p>
        </div>
      </div>
    );
  }

  // Логгируем при монтировании
  useEffect(() => {
    console.log('=== CHAT COMPONENT MOUNTED ===');
    console.log('Session ID:', sessionId);
    console.log('User Name:', userName);
    console.log('Character:', character.name);
  }, [character, sessionId, userName]);

  // Инициализируем оркестратор
  useEffect(() => {
    const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (openRouterKey) {
      orchestratorRef.current = new AIOrchestrator({
        mainModel: AI_MODELS.MAIN,
        summaryModel: AI_MODELS.WORKHORSE,
        imageModel: AI_MODELS.IMAGE,
        openRouterApiKey: openRouterKey,
        httpReferer: window.location.origin,
        xTitle: 'D&D Dark Fantasy RPG',
      });
    }
  }, []);

  const getAvatarEmoji = (avatarIcon?: string) => {
    const map: Record<string, string> = {
      warrior: '⚔️', mage: '🧙', rogue: '🗡️', cleric: '✨', ranger: '🏹',
    };
    return map[avatarIcon || ''] || '⚔️';
  };

  const themes = [
    { id: 'theme-emerald', name: 'Emerald' },
    { id: 'theme-crimson', name: 'Crimson' },
    { id: 'theme-amethyst', name: 'Amethyst' },
    { id: 'theme-amber', name: 'Amber' },
  ];

  const fetchDailyUsage = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('is_ai', true)
      .gte('created_at', today.toISOString());

    if (!error && count !== null) {
      setDailyPromptCount(count);
    }
  };

  // Загрузка участников сессии и их персонажей
  const fetchSessionParticipants = async () => {
    try {
      const { data: participants, error } = await supabase
        .from('game_session_participants')
        .select('*, character:character_id(*)')
        .eq('session_id', sessionId);

      if (error) throw error;

      console.log('=== SESSION PARTICIPANTS ===');
      console.log('Participants:', participants);

      setSessionParticipants(participants || []);

      // Строим мапу characterStats
      const stats: Record<string, Character> = {};
      participants?.forEach(p => {
        if (p.character) {
          stats[p.character.id] = p.character as Character;
          if (p.character.name === userName) {
            setSelectedCharacterId(p.character.id);
          }
        }
      });

      console.log('Character stats:', stats);
      setCharacterStats(stats);

      // Загружаем story_summary из персонажа текущего игрока
      const myCharacter = participants?.find(p => p.user_session_id === userSessionId)?.character as Character | undefined;
      if (myCharacter?.story_summary) {
        setStorySummary(myCharacter.story_summary);
      }
    } catch (err: any) {
      console.error('Error fetching participants:', err);
    }
  };

  // Загрузка сообщений
  const fetchMessages = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        setMessages(data || []);

        // Check for pause state
        const lastPauseMsg = [...(data || [])].reverse().find(m => 
          m.sender_id === 'system' && m.content.startsWith('PAUSE:')
        );
        if (lastPauseMsg) {
          setIsPaused(lastPauseMsg.content === 'PAUSE:TRUE');
        }

        return;
      } catch (err) {
        console.error(`Error fetching messages (attempt ${i + 1}):`, err);
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  };

  // Подписки
  useEffect(() => {
    fetchDailyUsage();
    fetchSessionParticipants();
    
    setTimeout(() => {
      fetchMessages();
    }, 500);

    // Подписка на сообщения
    const messagesChannel = supabase
      .channel(`session:${sessionId}:messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.is_ai) {
            setIsAIGenerating(false);
            setDailyPromptCount(prev => prev + 1);
          }
          setMessages((prev) => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    // Подписка на изменения персонажей
    const charactersChannel = supabase
      .channel(`session:${sessionId}:characters`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'characters',
        },
        (payload) => {
          const updatedCharacter = payload.new as Character;
          console.log('Character updated:', updatedCharacter.name);
          
          setCharacterStats(prev => ({
            ...prev,
            [updatedCharacter.id]: updatedCharacter
          }));

          // Обновляем story_summary если изменилось
          if (updatedCharacter.story_summary && updatedCharacter.name === userName) {
            setStorySummary(updatedCharacter.story_summary);
          }
        }
      )
      .subscribe();

    // Подписка на presence игроков
    const presenceChannel = supabase
      .channel(`session:${sessionId}:presence`, {
        config: { presence: { key: userName } },
      })
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const activePlayers = Object.values(state).flat() as {user: string, avatar?: string}[];
        setPlayers(activePlayers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user: userName,
            avatar: character?.avatar_icon || 'warrior',
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(charactersChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [sessionId]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Отправка сообщения
  const sendMessage = async (content: string, isRoll: boolean = false) => {
    if (!content.trim() || isLoading) return;

    const userMessage = content;
    if (!isRoll) {
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
    setIsLoading(true);

    try {
      const { data, error } = await supabase.from('messages').insert({
        session_id: sessionId,
        sender_id: 'user',
        sender_name: userName,
        content: userMessage,
        is_ai: false,
      }).select();

      if (error) throw error;

      if (data && data[0]) {
        const newMessage = data[0] as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      }

      setIsLoading(false);

      // Триггерим AI ответ
      if (!isRoll && !isPaused) {
        await generateAIResponse();
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setIsLoading(false);
    }
  };

  // Генерация AI ответа
  const generateAIResponse = async () => {
    if (!orchestratorRef.current || isGeneratingAI.current) return;
    
    isGeneratingAI.current = true;
    setIsAIGenerating(true);

    try {
      // Получаем последние сообщения
      const recentMessages = messages.slice(-15);
      
      // Конвертируем Character в CharacterStats для оркестратора
      const characterStatsForAI: any = {};
      Object.values(characterStats).forEach(char => {
        characterStatsForAI[char.name] = {
          name: char.name,
          race: char.race,
          class: char.class,
          level: char.level,
          hp: { current: char.hp_current, max: char.hp_max },
          xp: char.xp,
          stats: {
            strength: char.strength,
            dexterity: char.dexterity,
            constitution: char.constitution,
            intelligence: char.intelligence,
            wisdom: char.wisdom,
            charisma: char.charisma,
          },
          background: char.background,
          equipment: char.equipment,
          story_summary: char.story_summary,
        };
      });

      // Генерируем ответ через основную модель (Claude)
      const aiResponse = await orchestratorRef.current.processMessage(
        SYSTEM_PROMPT,
        recentMessages,
        characterStatsForAI
      );

      // Сохраняем AI ответ
      const { data: aiMessage } = await supabase.from('messages').insert({
        session_id: sessionId,
        sender_id: 'ai',
        sender_name: 'Dungeon Master',
        content: aiResponse,
        is_ai: true,
      }).select();

      // Парсим изменения статов через Gemini Flash
      const parseResult: StatsParseResult = await orchestratorRef.current!.parseStatsChanges(
        aiResponse,
        characterStatsForAI
      );

      console.log('Parsed stats changes:', parseResult);

      // Обновляем статы персонажей
      if (parseResult.changes.length > 0) {
        for (const change of parseResult.changes) {
          const char = Object.values(characterStats).find(c => c.name === change.characterName);
          if (!char) continue;

          const updates: any = {};
          
          if (change.hp) {
            updates.hp_current = change.hp.current;
            updates.hp_max = change.hp.max;
          }
          if (change.xp) {
            updates.xp = change.xp.current;
          }
          if (change.level) {
            updates.level = change.level.current;
          }
          if (change.story_summary) {
            updates.story_summary = change.story_summary;
          }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from('characters')
              .update(updates)
              .eq('id', char.id);
            
            console.log(`Updated ${char.name}:`, updates);
          }
        }
      }

      // Обновляем story_summary отдельно если нужно
      if (storySummary) {
        const lastMessage = aiMessage?.[0];
        if (lastMessage) {
          const newSummary = await orchestratorRef.current!.updateStorySummary(
            storySummary,
            lastMessage.content,
            aiResponse
          );
          
          if (newSummary !== storySummary) {
            await supabase
              .from('characters')
              .update({ story_summary: newSummary })
              .eq('id', char.id);
            
            setStorySummary(newSummary);
          }
        }
      }

    } catch (err: any) {
      console.error('Error generating AI response:', err);
    } finally {
      isGeneratingAI.current = false;
      setIsAIGenerating(false);
    }
  };

  // Бросок кубиков
  const rollDice = () => {
    setIsRolling(true);

    const lastDM = [...messages].reverse().find(m => m && m.is_ai && m.content);
    let diceType = 20;
    let count = 1;
    let bonus = 0;

    if (lastDM && typeof lastDM.content === 'string') {
      const diceMatch = lastDM.content.match(/(\d+)?d(\d+)([\+\-]\d+)?/i);
      if (diceMatch) {
        count = parseInt(diceMatch[1]) || 1;
        diceType = parseInt(diceMatch[2]) || 20;
        bonus = parseInt(diceMatch[3]) || 0;
      }
    }

    setTimeout(() => {
      let total = 0;
      const rolls = [];
      for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * diceType) + 1;
        rolls.push(r);
        total += r;
      }
      total += bonus;

      const rollStr = rolls.length > 1 ? `(${rolls.join(' + ')})` : rolls[0];
      const bonusStr = bonus !== 0 ? ` ${bonus > 0 ? '+' : ''}${bonus}` : '';

      const message = `🎲 **${count}d${diceType}${bonusStr} = ${total}**\n${rolls.length > 1 || bonus !== 0 ? `\n_Детали: ${rollStr}${bonusStr}_` : ''}`;

      sendMessage(message, true);
      setIsRolling(false);
    }, 800);
  };

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePause = async () => {
    const nextState = !isPaused;
    try {
      await supabase.from('messages').insert({
        session_id: sessionId,
        sender_id: 'system',
        sender_name: 'System',
        content: `PAUSE:${nextState ? 'TRUE' : 'FALSE'}`,
        is_ai: false,
      });
      setIsPaused(nextState);
    } catch (err) {
      console.error('Error toggling pause:', err);
    }
  };

  // Получаем текущего персонажа для виджета
  const currentCharacter = selectedCharacterId ? characterStats[selectedCharacterId] : character;

  return (
    <div className={cn('min-h-screen bg-zinc-950 text-zinc-100 flex', theme)}>
      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="shrink-0 bg-zinc-900/50 backdrop-blur border-b border-zinc-800 p-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onLeave}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">Сессия {sessionId}</h1>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Users className="w-3 h-3" />
                  <span>{players.length} онлайн</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={rollDice}
                disabled={isRolling}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-colors disabled:opacity-50"
              >
                <Dices className={cn("w-4 h-4", isRolling && "animate-spin")} />
                <span className="text-sm font-bold">Бросок</span>
              </button>

              <button
                onClick={togglePause}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-colors",
                  isPaused 
                    ? "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400" 
                    : "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
                )}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span className="text-sm font-bold">{isPaused ? 'Пауза' : 'Игра'}</span>
              </button>

              <button
                onClick={() => setIsStatsPanelOpen(!isStatsPanelOpen)}
                className={cn(
                  "p-2 border rounded-xl transition-colors",
                  isStatsPanelOpen
                    ? "bg-primary/20 border-primary/30 text-primary"
                    : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                )}
              >
                <TrendingUp className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 md:p-6"
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                isOwn={message.sender_name === userName}
              />
            ))}
            {isAIGenerating && (
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Мастер плетет историю...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 bg-zinc-900/50 backdrop-blur border-t border-zinc-800 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-2">
              <TextareaAutosize
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder={isPaused ? "Игра на паузе..." : "Что вы делаете?"}
                disabled={isPaused || isLoading}
                minRows={1}
                maxRows={4}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading || isPaused}
                className="p-3 bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Panel - Right Sidebar */}
      <AnimatePresence>
        {isStatsPanelOpen && currentCharacter && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="shrink-0 bg-zinc-900 border-l border-zinc-800 overflow-hidden"
          >
            <div className="w-[280px] p-4 h-screen overflow-y-auto">
              {/* Character Header */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-zinc-800">
                <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-2xl">
                  {getAvatarEmoji(currentCharacter.avatar_icon)}
                </div>
                <div>
                  <h3 className="font-bold text-white">{currentCharacter.name}</h3>
                  <p className="text-xs text-zinc-500">
                    {currentCharacter.race} • {currentCharacter.class}
                  </p>
                </div>
              </div>

              {/* Level */}
              <div className="mb-4 p-3 bg-zinc-950 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase">Уровень</span>
                  <span className="text-lg font-bold text-primary">{currentCharacter.level}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Star className="w-3 h-3" />
                  <span>XP: {currentCharacter.xp}</span>
                </div>
              </div>

              {/* HP Bar */}
              <div className="mb-4 p-3 bg-zinc-950 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1">
                    <Heart className="w-3 h-3 text-red-500" />
                    Здоровье
                  </span>
                  <span className="text-sm font-bold text-red-400">
                    {currentCharacter.hp_current}/{currentCharacter.hp_max}
                  </span>
                </div>
                <div className="bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-red-500 h-full transition-all"
                    style={{ 
                      width: `${(currentCharacter.hp_current / currentCharacter.hp_max) * 100}%` 
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="mb-4">
                <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Характеристики</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Сила', key: 'strength', icon: Swords },
                    { name: 'Ловкость', key: 'dexterity', icon: Zap },
                    { name: 'Телосложение', key: 'constitution', icon: Heart },
                    { name: 'Интеллект', key: 'intelligence', icon: BookOpen },
                    { name: 'Мудрость', key: 'wisdom', icon: Shield },
                    { name: 'Харизма', key: 'charisma', icon: UserIcon },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    const value = currentCharacter[stat.key as keyof Character] as number;
                    const mod = Math.floor((value - 10) / 2);
                    return (
                      <div key={stat.key} className="p-2 bg-zinc-950 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Icon className="w-3 h-3 text-zinc-500" />
                          <span className="text-xs text-zinc-400">{stat.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-white">{value}</span>
                          <span className="text-xs text-zinc-500 ml-1">
                            {mod >= 0 ? '+' : ''}{mod}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Background */}
              {currentCharacter.background && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Предыстория</h4>
                  <p className="text-xs text-zinc-400 italic line-clamp-3">
                    {currentCharacter.background}
                  </p>
                </div>
              )}

              {/* Equipment */}
              {currentCharacter.equipment && currentCharacter.equipment.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Снаряжение</h4>
                  <div className="space-y-1">
                    {currentCharacter.equipment.slice(0, 5).map((item, i) => (
                      <div key={i} className="text-xs text-zinc-400 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        <span className="truncate">{item}</span>
                      </div>
                    ))}
                    {currentCharacter.equipment.length > 5 && (
                      <p className="text-xs text-zinc-600">
                        +{currentCharacter.equipment.length - 5} ещё
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Story Summary */}
              {storySummary && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">История</h4>
                  <p className="text-xs text-zinc-400 line-clamp-4">{storySummary}</p>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3",
        isOwn ? "flex-row-reverse" : ""
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
        message.is_ai 
          ? "bg-primary/20 text-primary" 
          : isOwn 
            ? "bg-zinc-800 text-zinc-400"
            : "bg-zinc-800 text-zinc-400"
      )}>
        {message.is_ai ? <ScrollText className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
      </div>
      
      <div className={cn(
        "max-w-[80%] rounded-2xl p-4",
        isOwn 
          ? "bg-primary/10 border border-primary/20" 
          : message.is_ai
            ? "bg-zinc-900 border border-zinc-800"
            : "bg-zinc-800"
      )}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-zinc-400">{message.sender_name}</span>
          <span className="text-[10px] text-zinc-600">
            {new Date(message.created_at).toLocaleTimeString('ru-RU', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
        
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          className="prose prose-invert prose-sm max-w-none text-zinc-300"
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
}
