import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User as UserIcon, Loader2, Image as ImageIcon, Dices, Copy, Check, ChevronLeft, X, Layers, Maximize2, Download, Play, Pause, MoreVertical, Shield, Swords, Zap, BookOpen, Briefcase, Palette, ScrollText } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Groq } from 'groq-sdk';
import TextareaAutosize from 'react-textarea-autosize';
import { CharacterStats, Message, Room, Character } from '../types';
import { AIOrchestrator } from '../lib/ai-orchestrator';
import { AI_MODELS } from '../lib/ai-config';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatProps {
  roomId: string;
  userName: string;
  character?: Character | null;
  onLeave: () => void;
  onCharacterNeeded?: () => void;
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
- Механика и расчеты: Используй LaTeX для формул в формате $1d20 + 5$ (без \text{}, просто формула). Примеры:
  - ✅ Правильно: $1d20 + 5$, $2d6 + 3$, $1d8 + 2$
  - ❌ Неправильно: \text{1d20 + 5}, $$1d20 + 5$$
- Варианты действий: ВСЕГДА завершай сообщение списком возможных действий (минимум 3 варианта).
- Не упоминай изображения или визуализацию — ты текстовый ИИ.
- **ДЛИНА ОТВЕТА**: Пиши ПОДРОБНЫЕ, атмосферные ответы (300-800 слов). Не обрезай мысли на полуслове. Разрешай сцену полностью, прежде чем предлагать варианты действий.

УПРАВЛЕНИЕ ХАРАКТЕРИСТИКАМИ (Character Sheet):
Ты обязан отслеживать состояние каждого персонажа (HP, XP, характеристики).

ВАЖНО: НИКОГДА не пиши в ответе фразы типа "Текущие состояния героев:" или JSON с данными персонажей. Игрок видит статы в интерфейсе.

В НАЧАЛЕ ИГРЫ ты получишь полные данные персонажа игрока [ДАННЫЕ ПЕРСОНАЖА ИГРОКА]. ИСПОЛЬЗУЙ ЭТИ ДАННЫЕ для всего повествования. НЕ придумывай нового персонажа - используй имя, расу, класс, характеристики и предысторию из этих данных!

Когда характеристики персонажа меняются (получение урона, лечение, получение опыта, повышение уровня или создание персонажа), ты ДОЛЖЕН в самом конце своего сообщения добавить скрытый блок.

ПРАВИЛЬНЫЙ ФОРМАТ (в самом конце, после ВСЕГО текста):
[STATS_UPDATE:{"name":"Имя","race":"Раса","class":"Класс","level":1,"hp":{"current":10,"max":10},"xp":0,"stats":{"strength":10,"dexterity":10,"constitution":10,"intelligence":10,"wisdom":10,"charisma":10},"background":"Предыстория","equipment":["Предмет1"],"story_summary":"Сводка"}]

НЕПРАВИЛЬНО:
- Не пиши [STATS_UPDATE] в начале или середине сообщения
- Не используй обратные кавычки для JSON блока
- Не пиши ничего после [STATS_UPDATE]
- Не упоминай этот блок в тексте

ВАЖНО:
- Блок ДОЛЖЕН быть в самом конце, после последнего предложения
- Поле "name" ДОЛЖНО точно совпадать с именем игрока
- Этот блок будет вырезан системой - игрок его не увидит
- ОБЯЗАТЕЛЬНО включай story_summary!

КРАТКИЕ СВОДКИ:
- При получении урона/лечения: кратко упомяни в тексте (например: "Вы получили 3 урона, осталось 7 HP").
- При получении опыта: не пиши отдельно, система сама покажет уведомление.
- При повышении уровня: поздравь в тексте (например: "Новый уровень!").

ДОЛГОСРОЧНАЯ ПАМЯТЬ (story_summary):
Путешествие может длиться долго. Чтобы ничего не забыть, ты ДОЛЖЕН периодически обновлять поле "story_summary" в JSON-блоке. Записывай туда самые важные события, имена встреченных ключевых NPC, текущие квесты и цели. Это твоя память! Если в текущих статах (которые я тебе передам) уже есть story_summary, ОБЯЗАТЕЛЬНО учитывай его в сюжете, это то, что было раньше!
ОБНОВЛЯЙ summary КАЖДОЕ сообщение, добавляя новые события. Формат: краткое описание (2-3 предложения) всего, что произошло.

ПЕРВЫЙ ШАГ: Создание Персонажа
Остановись и попроси меня предоставить данные персонажа. Если я не дал какие-то данные, предложи логичные варианты. После утверждения персонажа ОБЯЗАТЕЛЬНО выведи первый блок UPDATE_STATS с полными характеристиками.

ДОПОЛНИТЕЛЬНО:
- Прогрессия: Герои начинают слабыми. Отслеживай XP и повышай уровень согласно правилам D&D 5e.
- Лор: Используй [[ТЕКСТ]] для справок по лору.`;

export default function Chat({ roomId, userName, character, onLeave, onCharacterNeeded, theme, setTheme }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [players, setPlayers] = useState<{user: string, avatar?: string}[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<string>('');
  // Храним характеристики для всех игроков в комнате
  const [characterStats, setCharacterStats] = useState<Record<string, CharacterStats> | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [dailyPromptCount, setDailyPromptCount] = useState(0);
  const DAILY_LIMIT = 1500;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isGeneratingAI = useRef(false);
  // Глобальное состояние генерации AI — синхронизируется между всеми игроками
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  // Храним краткую историю для экономии токенов
  const [storySummary, setStorySummary] = useState<string>('');
  // AI Orchestrator для генерации ответов
  const orchestratorRef = useRef<AIOrchestrator | null>(null);
  // Состояния для генерации изображений
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // Если нет персонажа - показываем уведомление
  // Эта проверка теперь в App.tsx, но оставим на всякий случай
  if (!character) {
    console.error('=== CHAT: NO CHARACTER ===');
    console.error('roomId:', roomId);
    console.error('userName:', userName);
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm">Загрузка персонажа...</p>
          <p className="text-zinc-500 text-xs">Если долго загружается — обновите страницу</p>
          <p className="text-red-500 text-xs">roomId: {roomId}</p>
        </div>
      </div>
    );
  }

  // Логгируем character при монтировании
  useEffect(() => {
    console.log('=== CHAT COMPONENT MOUNTED ===');
    console.log('Character props:', character);
    console.log('Room ID:', roomId);
    console.log('User Name:', userName);
  }, [character, roomId, userName]);

  // Инициализируем оркестратор при загрузке
  useEffect(() => {
    const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (openRouterKey) {
      orchestratorRef.current = new AIOrchestrator({
        mainModel: AI_MODELS.MAIN,           // Claude Sonnet 4.6
        summaryModel: AI_MODELS.WORKHORSE,   // Gemini 2.5 Flash
        imageModel: AI_MODELS.IMAGE,         // GPT-5 Image Mini
        openRouterApiKey: openRouterKey,
        httpReferer: window.location.origin,
        xTitle: 'D&D Dark Fantasy RPG',
      });
    }
  }, []);

  const getAvatarEmoji = (avatarIcon?: string) => {
    const map: Record<string, string> = {
      warrior: '⚔️',
      mage:    '🧙',
      rogue:   '🗡️',
      cleric:  '✨',
      ranger:  '🏹',
    };
    return map[avatarIcon || ''] || '⚔️';
  };

  const themes = [
    { id: 'theme-emerald', name: 'Emerald' },
    { id: 'theme-crimson', name: 'Crimson' },
    { id: 'theme-amethyst', name: 'Amethyst' },
    { id: 'theme-amber', name: 'Amber' },
  ];

  const cycleTheme = () => {
    const currentIndex = themes.findIndex(t => t.id === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex].id);
  };

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

  useEffect(() => {
    fetchMessages();
    fetchDailyUsage();

    // Автоматически инициализируем персонажа если он передан
    if (character) {
      const characterStatsData: CharacterStats = {
        name: character.name,
        race: character.race,
        class: character.class,
        level: character.level,
        hp: {
          current: character.hp_current,
          max: character.hp_max,
        },
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
        story_summary: character.story_summary || '',
      };

      // Сохраняем в БД асинхронно
      updateRoomStats(character.name, characterStatsData);
    }

    // Загружаем данные комнаты ПОСЛЕ того как игрок добавил себя
    // Это гарантирует что все игроки видят актуальные данные
    setTimeout(() => {
      fetchRoomStats();
    }, 500);

    // Повторная загрузка через 2 секунды для синхронизации
    setTimeout(() => {
      fetchRoomStats();
      console.log('🔄 Re-fetching room stats for sync');
    }, 2000);
    
    // Загружаем summary из последней характеристики
    const savedStats = localStorage.getItem(`room_stats_${roomId}`);
    if (savedStats) {
      try {
        const stats = JSON.parse(savedStats);
        const playerStats = stats[userName];
        if (playerStats?.story_summary) {
          setStorySummary(playerStats.story_summary);
        }
      } catch (e) {
        console.error('Failed to load story summary:', e);
      }
    }
    
    const channel = supabase
      .channel(`room:${roomId}`, {
        config: {
          presence: {
            key: userName,
          },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.sender_id === 'system' && newMessage.content.startsWith('PAUSE:')) {
            setIsPaused(newMessage.content === 'PAUSE:TRUE');
          }
          if (newMessage.is_ai) {
            setDailyPromptCount(prev => prev + 1);
            // AI ответил — сбрасываем флаг генерации
            setIsAIGenerating(false);
          }
          setMessages((prev) => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      // Подписка на изменения характеристик персонажей
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          // Проверяем, изменился ли флаг is_ai_generating
          const newIsGenerating = payload.new.is_ai_generating;
          const oldIsGenerating = payload.old.is_ai_generating;
          if (newIsGenerating !== oldIsGenerating) {
            setIsAIGenerating(!!newIsGenerating);
            console.log('AI generating status changed:', newIsGenerating);
          }
          
          // Проверяем, изменились ли характеристики персонажей
          const newStats = payload.new.character_stats;
          const oldStats = payload.old.character_stats;
          if (newStats && newStats !== oldStats) {
            console.log('📊 Character stats changed via postgres_changes');
            setCharacterStats(newStats as Record<string, CharacterStats>);
            
            // Обновляем story_summary если изменилось
            const currentPlayer = Object.keys(newStats).find(name => 
              name === userName || newStats[name]?.name === userName
            );
            if (currentPlayer && newStats[currentPlayer]?.story_summary) {
              setStorySummary(newStats[currentPlayer].story_summary);
            }
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activePlayers = Object.values(state).flat() as {user: string, avatar?: string}[];
        setPlayers(activePlayers);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Player joined
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        // Player left
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user: userName,
            avatar: character?.avatar_icon || 'warrior',
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fetchRoomStats = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('character_stats')
        .eq('id', roomId)
        .single();

      if (error) {
        console.error('Error fetching room stats:', error);
        return;
      }

      if (data?.character_stats) {
        console.log('📥 Fetched room stats:', Object.keys(data.character_stats));
        setCharacterStats(data.character_stats as Record<string, CharacterStats>);

        // Устанавливаем текущего игрока если ещё не выбран
        if (character && !selectedPlayerForStats) {
          setSelectedPlayerForStats(character.name);
        } else if (!character && userName && !selectedPlayerForStats) {
          // Если нет character, ищем по userName
          const currentPlayer = Object.keys(data.character_stats).find(name =>
            name === userName || data.character_stats[name].name === userName
          );
          if (currentPlayer) setSelectedPlayerForStats(currentPlayer);
        }
      } else {
        console.log('No character stats in room yet');
      }
    } catch (err) {
      console.error('Failed to fetch room stats:', err);
    }
  };

  const updateRoomStats = async (playerName: string, stats: CharacterStats) => {
    try {
      console.log('💾 Updating room stats for:', playerName);
      
      // Получаем текущие характеристики
      const { data: currentData } = await supabase
        .from('rooms')
        .select('character_stats')
        .eq('id', roomId)
        .single();

      const allStats = currentData?.character_stats || {};

      // Обновляем характеристики конкретного игрока
      const updatedStats = {
        ...allStats,
        [playerName]: stats
      };

      console.log('Saving to database:', {
        room_id: roomId,
        character: playerName,
        hp: stats.hp,
        xp: stats.xp,
        level: stats.level
      });

      const { error } = await supabase
        .from('rooms')
        .update({ character_stats: updatedStats })
        .eq('id', roomId);

      if (error) {
        console.error('Error updating room stats:', error);
      } else {
        console.log('✅ Room stats updated successfully');
      }
    } catch (err) {
      console.error('Failed to update room stats:', err);
    }
  };

  // Получаем характеристики текущего игрока или выбранного
  const getCurrentPlayerStats = (): CharacterStats | null => {
    if (!characterStats) return null;

    // Если выбран конкретный игрок - показываем его
    if (selectedPlayerForStats && characterStats[selectedPlayerForStats]) {
      return characterStats[selectedPlayerForStats];
    }

    // Сначала пробуем найти по имени персонажа
    if (character && characterStats[character.name]) {
      return characterStats[character.name];
    }

    // Потом по userName
    if (userName && characterStats[userName]) {
      return characterStats[userName];
    }

    // Если ничего не нашли, возвращаем первого доступного
    const firstPlayer = Object.keys(characterStats)[0];
    return firstPlayer ? characterStats[firstPlayer] : null;
  };

  const fetchMessages = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await Promise.race([
          supabase
            .from('messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 20000))
        ]) as any;

        if (error) {
          console.error(`Error fetching messages (attempt ${i + 1}):`, error);
          if (i === retries - 1) throw error;
          await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
          continue;
        }

        setMessages(data || []);
        
        // Check for pause state in history
        const lastPauseMsg = [...(data || [])].reverse().find(m => m.sender_id === 'system' && m.content.startsWith('PAUSE:'));
        if (lastPauseMsg) {
          setIsPaused(lastPauseMsg.content === 'PAUSE:TRUE');
        }
        
        // Don't auto-trigger AI greeting - user will click button
        return; // Success
      } catch (err) {
        console.error(`Network error fetching messages (attempt ${i + 1}):`, err);
        if (i === retries - 1) {
          // Final failure - maybe show a UI hint
        }
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  };

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
        room_id: roomId,
        sender_id: 'user',
        sender_name: userName,
        content: userMessage,
        is_ai: false,
      }).select();

      if (error) {
        console.error('Error sending message:', error);
        setIsLoading(false);
        return;
      }

      if (data && data[0]) {
        const newMessage = data[0] as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      }
      
      // Сбрасываем isLoading после успешной отправки
      setIsLoading(false);
    } catch (err) {
      console.error('Network error sending message:', err);
      setIsLoading(false);
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePause = async () => {
    const nextState = !isPaused;
    try {
      const { data } = await supabase.from('messages').insert({
        room_id: roomId,
        sender_id: 'system',
        sender_name: 'System',
        content: `PAUSE:${nextState ? 'TRUE' : 'FALSE'}`,
        is_ai: false,
      }).select();

      if (!nextState && data && data[0]) {
        // If unpausing, just update the state - don't trigger AI response
        // The AI will respond when the user sends the next message
        const newMessage = data[0] as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      }
    } catch (err) {
      console.error('Error toggling pause:', err);
    }
  };

  const rollDice = () => {
    setIsRolling(true);
    
    // Smart Roll: Parse last DM message for dice notation
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
      
      // Формат с LaTeX для красивой формулы
      const message = `🎲 **${count}d${diceType}${bonusStr} = ${total}**\n${rolls.length > 1 || bonus !== 0 ? `\n_Детали: ${rollStr}${bonusStr}_` : ''}`;

      sendMessage(message, true);
      setIsRolling(false);
    }, 800);
  };

  const generateSceneImage = async () => {
    if (!orchestratorRef.current) {
      alert('AI Orchestrator не инициализирован');
      return;
    }

    setIsGeneratingImage(true);
    try {
      // Получаем последние сообщения для контекста
      const recentMessages = messages.slice(-5);
      
      // Генерируем промпт через AI
      const prompt = await orchestratorRef.current.generateImagePrompt(
        recentMessages,
        characterStats || {}
      );

      setCurrentPrompt(prompt);

      // Генерируем изображение
      const result = await orchestratorRef.current.generateImage(prompt);

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.imageUrl) {
        setGeneratedImageUrl(result.imageUrl);
        setIsImageModalOpen(true);
      } else {
        throw new Error('Не удалось получить изображение');
      }
    } catch (error: any) {
      console.error('Image generation error:', error);
      alert(`Ошибка генерации: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const sendImageToChat = async () => {
    if (!generatedImageUrl || !currentPrompt) {
      console.error('Cannot save: missing image or prompt');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const shortPrompt = currentPrompt.slice(0, 50).replace(/[\[\]()]/g, '');
      const imageMarkdown = `![${shortPrompt}](${generatedImageUrl})`;

      console.log('Saving image to gallery, payload size:', imageMarkdown.length);

      const { data, error } = await supabase.from('messages').insert({
        room_id: roomId,
        sender_id: 'gallery-item',
        sender_name: 'Visual Archive',
        content: imageMarkdown,
        is_ai: true,
      }).select();

      if (error) {
        console.error('Supabase Insert Error:', error);
        alert(`Ошибка базы данных: ${error.message}`);
        return;
      }

      console.log('Image saved successfully to gallery:', data);

      // НЕ добавляем в чат локально - придёт через postgres_changes подписку
      // Это гарантирует что ВСЕ игроки увидят изображение

      setIsImageModalOpen(false);
      setGeneratedImageUrl(null);

      // Открываем галерею для просмотра
      setTimeout(() => setIsGalleryOpen(true), 100);
    } catch (error: any) {
      console.error('Error saving to gallery:', error);
      alert(`Критическая ошибка: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const triggerAIResponse = async (history: Message[], force: boolean = false) => {
    if (isGeneratingAI.current) {
      console.log("AI is already generating, skipping...");
      return;
    }

    // Check pause state from history (most reliable for sync)
    const lastPauseMsg = [...history].reverse().find(m => m.sender_id === 'system' && m.content.startsWith('PAUSE:'));
    const currentIsPaused = lastPauseMsg ? lastPauseMsg.content === 'PAUSE:TRUE' : false;

    if (currentIsPaused && !force) {
      console.log("AI is paused. Skipping response.");
      return;
    }

    isGeneratingAI.current = true;
    
    // Устанавливаем флаг генерации AI в БД — все игроки увидят индикатор
    setIsAIGenerating(true);
    await supabase
      .from('rooms')
      .update({ is_ai_generating: true })
      .eq('id', roomId);

    // Get unique players who have sent a message RECENTLY (last 10 minutes)
    const TEN_MINUTES = 10 * 60 * 1000;
    const now = Date.now();

    // ВАЖНО: Берём игроков из characterStats, а не из presence
    // Потому что presence может быть неточным
    const activePlayersSet = new Set(
      history
        .filter(m => !m.is_ai && m.sender_id !== 'system' && m.content && typeof m.content === 'string')
        .filter(m => {
          const msgTime = new Date(m.created_at || now).getTime();
          return (now - msgTime) < TEN_MINUTES;
        })
        .map(m => m.sender_name)
    );

    const activePlayers = Array.from(activePlayersSet);
    
    console.log('Active players from history:', activePlayers);
    console.log('Character stats available:', characterStats ? Object.keys(characterStats) : 'none');

    // Ждём только если есть несколько игроков в characterStats
    const playersInRoom = characterStats ? Object.keys(characterStats) : [];
    
    if (playersInRoom.length > 1) {
      // Find messages since the last DM (storyteller) response
      const reversedHistory = [...history].reverse();
      const lastAiIndex = reversedHistory.findIndex(m => m.is_ai && m.sender_name === 'Dungeon Master');

      // Get messages after last AI response
      const messagesSinceLastAi = lastAiIndex === -1
        ? history
        : history.slice(history.length - lastAiIndex);

      const playersWhoActedSet = new Set(
        messagesSinceLastAi
          .filter(m => !m.is_ai && m.sender_id !== 'system' && m.content && typeof m.content === 'string')
          .map(m => m.sender_name)
      );

      // Проверяем, отправили ли ВСЕ игроки из комнаты сообщения
      const allPlayersActed = playersInRoom.every(player => playersWhoActedSet.has(player));

      if (!allPlayersActed) {
        const waitingFor = playersInRoom.filter(p => !playersWhoActedSet.has(p));
        console.log(`⏳ Waiting for all players to respond... In room: ${playersInRoom.join(', ')}, Acted: ${Array.from(playersWhoActedSet).join(', ')}, Waiting for: ${waitingFor.join(', ')}`);
        isGeneratingAI.current = false;
        // НЕ сбрасываем isAIGenerating - пусть другие игроки видят что идёт ожидание
        return;
      }
      
      console.log('✅ All players have acted, generating AI response');
    } else {
      console.log('Single player or no character stats, proceeding immediately');
    }

    const wasLoading = isLoading;
    if (!wasLoading) setIsLoading(true);

    // Filter out NON-RP messages and pause toggles
    let isCurrentlyPaused = false;
    const rpHistory: Message[] = [];
    for (const msg of history) {
      if (msg.sender_id === 'system' && msg.content.startsWith('PAUSE:')) {
        isCurrentlyPaused = msg.content === 'PAUSE:TRUE';
        continue;
      }
      if (!isCurrentlyPaused) {
        rpHistory.push(msg);
      }
    }

    // Бери последние 10 сообщений для лучшего контекста
    const recentHistory = rpHistory.slice(-10);

    let chatHistory = recentHistory
        .filter(msg => msg.content && typeof msg.content === 'string')
        .filter(msg => msg.sender_id !== 'gallery' && msg.sender_id !== 'gallery-item')
        .map((msg) => {
          // Сокращаем ОЧЕНЬ длинные сообщения до 4000 символов (вместо 1500)
          let content = msg.content;
          if (content.length > 4000) {
            content = content.substring(0, 4000) + "...";
          }
          return {
            role: msg.is_ai ? 'assistant' : 'user',
            content: `${msg.sender_name}: ${content}`,
          };
        });

    // Добавляем summary в начало как контекст
    if (storySummary) {
      chatHistory.unshift({
        role: 'system',
        content: `[PREVIOUS STORY SUMMARY: ${storySummary}]`,
      });
    }

    if (chatHistory.length === 0) {
      chatHistory = [{
        role: 'user',
        content: "Начни игру и поприветствуй меня."
      }];
    }

    // Используем AI Orchestrator с Claude Sonnet
    if (!orchestratorRef.current) {
      console.error('AI Orchestrator not initialized. Check OPENROUTER_API_KEY.');
      isGeneratingAI.current = false;
      if (!wasLoading) setIsLoading(false);
      return;
    }

    try {
      console.log('=== AI GENERATION STARTED ===');
      console.log('Character props:', character);
      console.log('CharacterStats:', characterStats);

      // Добавляем данные ВСЕХ персонажей в промпт
      let effectiveSystemPrompt = SYSTEM_PROMPT;
      
      if (characterStats && Object.keys(characterStats).length > 0) {
        const allCharactersInfo = '\n\n[ДАННЫЕ ПЕРСОНАЖЕЙ ИГРОКОВ - ИСПОЛЬЗУЙ ЭТИ ДАННЫЕ ВСЕГДА]:\n' + 
          Object.values(characterStats).map((stats: CharacterStats) => `
=== ПЕРСОНАЖ: ${stats.name} ===
Раса: ${stats.race}
Класс: ${stats.class}
Уровень: ${stats.level}
HP: ${stats.hp.current}/${stats.hp.max}
XP: ${stats.xp}
Характеристики: STR ${stats.stats.strength}, DEX ${stats.stats.dexterity}, CON ${stats.stats.constitution}, INT ${stats.stats.intelligence}, WIS ${stats.stats.wisdom}, CHA ${stats.stats.charisma}
Предыстория: ${stats.background}
Снаряжение: ${stats.equipment ? stats.equipment.join(', ') : 'Нет'}
`).join('\n');

        effectiveSystemPrompt = SYSTEM_PROMPT + allCharactersInfo;

        console.log('✅ All characters data ADDED to prompt:', Object.keys(characterStats).join(', '));
        console.log('Full system prompt length:', effectiveSystemPrompt.length);
      } else if (character) {
        console.log('❌ WARNING: No character data available!');
      }

      let aiText = await orchestratorRef.current.processMessage(
        effectiveSystemPrompt,
        rpHistory,
        characterStats || {}
      );
      
      console.log('✅ AI Response received, length:', aiText.length);

      // Parse for stats update - поддерживаем оба формата
      // Ищем [STATS_UPDATE:...] в любом месте текста
      const statsUpdateMatch = aiText.match(/\[STATS_UPDATE:\s*({[\s\S]*?})\s*\]/);
      const jsonMatch = aiText.match(/```json\n([\s\S]*?)\n```/);

      let notificationText = '';
      let statsFound = false;

      // Пробуем новый формат [STATS_UPDATE:{...}]
      if (statsUpdateMatch) {
        console.log('📊 Found STATS_UPDATE block in new format');
        statsFound = true;
        try {
          const jsonData = JSON.parse(statsUpdateMatch[1]);
          const updatedStats = jsonData as CharacterStats;
          const playerName = updatedStats.name || userName;

          console.log('Player:', playerName);
          console.log('HP:', updatedStats.hp);
          console.log('XP:', updatedStats.xp);
          console.log('Level:', updatedStats.level);

          // Получаем предыдущие статы для сравнения
          const prevStats = characterStats?.[playerName];
          
          // Генерируем текстовое уведомление об изменениях
          if (prevStats) {
            const hpDiff = updatedStats.hp.current - prevStats.hp.current;
            const xpDiff = updatedStats.xp - prevStats.xp;
            const levelDiff = updatedStats.level - prevStats.level;
            
            const changes: string[] = [];
            
            if (hpDiff !== 0) {
              const hpSign = hpDiff > 0 ? '+' : '';
              const hpColor = hpDiff > 0 ? '🟢' : '🔴';
              changes.push(`${hpColor} HP: ${hpSign}${hpDiff} (${prevStats.hp.current} → ${updatedStats.hp.current})`);
            }
            
            if (xpDiff > 0) {
              changes.push(`⭐ XP: +${xpDiff} (${prevStats.xp} → ${updatedStats.xp})`);
            }
            
            if (levelDiff > 0) {
              changes.push(`🎯 Уровень повышен: ${prevStats.level} → ${updatedStats.level}!`);
            }
            
            if (changes.length > 0) {
              notificationText = '\n\n━━━\n' + 
                '**📊 Изменения персонажа**\n' + 
                changes.join('\n') + 
                '\n━━━\n\n';
            }
          }

          // Обновляем локальное состояние
          setCharacterStats(prev => ({
            ...prev,
            [playerName]: updatedStats
          }));

          // Обновляем базу данных
          updateRoomStats(playerName, updatedStats);

          // Сохраняем summary для экономии токенов
          if (updatedStats.story_summary) {
            console.log('Story summary updated:', updatedStats.story_summary.slice(0, 100) + '...');
            setStorySummary(updatedStats.story_summary);
            // Сохраняем в localStorage для быстрого доступа
            const allStats = characterStats || {};
            allStats[playerName] = updatedStats;
            localStorage.setItem(`room_stats_${roomId}`, JSON.stringify(allStats));
          }

          // Strip the STATS_UPDATE block from the output
          // Удаляем даже если есть пробелы и переносы строк
          aiText = aiText.replace(/\[STATS_UPDATE:\s*({[\s\S]*?})\s*\]/g, '').trim();
          // Удаляем лишние пустые строки в конце
          aiText = aiText.replace(/\n\s*\n\s*$/, '\n').trim();
        } catch (e) {
          console.error('Failed to parse STATS_UPDATE JSON:', e);
        }
      }
      // Старый формат ```json {...} ``` для обратной совместимости
      else if (jsonMatch) {
        console.log('📊 Found JSON block in old format');
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          if (jsonData.type === 'UPDATE_STATS' && jsonData.stats) {
            const updatedStats = jsonData.stats as CharacterStats;
            const playerName = updatedStats.name || userName;

            const prevStats = characterStats?.[playerName];
            
            if (prevStats) {
              const hpDiff = updatedStats.hp.current - prevStats.hp.current;
              const xpDiff = updatedStats.xp - prevStats.xp;
              const levelDiff = updatedStats.level - prevStats.level;
              
              const changes: string[] = [];
              
              if (hpDiff !== 0) {
                const hpSign = hpDiff > 0 ? '+' : '';
                const hpColor = hpDiff > 0 ? '🟢' : '🔴';
                changes.push(`${hpColor} HP: ${hpSign}${hpDiff} (${prevStats.hp.current} → ${updatedStats.hp.current})`);
              }
              
              if (xpDiff > 0) {
                changes.push(`⭐ XP: +${xpDiff} (${prevStats.xp} → ${updatedStats.xp})`);
              }
              
              if (levelDiff > 0) {
                changes.push(`🎯 Уровень повышен: ${prevStats.level} → ${updatedStats.level}!`);
              }
              
              if (changes.length > 0) {
                notificationText = '\n\n━━━\n' + 
                  '**📊 Изменения персонажа**\n' + 
                  changes.join('\n') + 
                  '\n━━━\n\n';
              }
            }

            setCharacterStats(prev => ({
              ...prev,
              [playerName]: updatedStats
            }));

            updateRoomStats(playerName, updatedStats);

            if (updatedStats.story_summary) {
              setStorySummary(updatedStats.story_summary);
              const allStats = characterStats || {};
              allStats[playerName] = updatedStats;
              localStorage.setItem(`room_stats_${roomId}`, JSON.stringify(allStats));
            }

            aiText = aiText.replace(/```json\n([\s\S]*?)\n```/, '').trim();
          }
        } catch (e) {
          console.error('Failed to parse stats JSON:', e);
        }
      }

      // Добавляем уведомление перед основным текстом
      const finalContent = notificationText + aiText;

      const { data } = await supabase.from('messages').insert({
        room_id: roomId,
        sender_id: 'ai',
        sender_name: 'Dungeon Master',
        content: finalContent,
        is_ai: true,
      }).select();

      if (data && data[0]) {
        setMessages(prev => {
          if (prev.some(m => m.id === data[0].id)) return prev;
          return [...prev, data[0] as Message];
        });
      }
    } catch (error: any) {
      console.error('AI Response Error:', error);
      console.error('AI Response Error Status:', error?.status);
      console.error('AI Response Error Message:', error?.message);

      let errorMessage = "Мастер сейчас недоступен. Пожалуйста, попробуйте позже.";

      // Проверяем на лимиты (Rate Limit)
      if (error?.status === 429 || error?.message?.includes('429')) {
        errorMessage = "Силы Мастера временно иссякли (Превышен лимит запросов). Пожалуйста, подождите одну минуту.";
      }
      // Проверяем на ошибку авторизации
      else if (error?.status === 401 || error?.message?.includes('401')) {
        errorMessage = "Ошибка авторизации. Проверьте ваш OpenRouter API ключ.";
      }
      // Проверяем на ошибку доступа
      else if (error?.status === 403 || error?.message?.includes('403')) {
        errorMessage = "Ошибка доступа к API. Проверьте ваш OpenRouter API ключ.";
      }
      // Проверяем на неверный запрос
      else if (error?.status === 400 || error?.message?.includes('400')) {
        errorMessage = "Неверный запрос к API. Проверьте формат сообщения.";
      }
      // Проверяем на ошибку сети
      else if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
        errorMessage = "Ошибка сети. Проверьте интернет-соединение.";
      }

      // Add a system message to inform the user
      const { data } = await supabase.from('messages').insert({
        room_id: roomId,
        sender_id: 'system',
        sender_name: 'System',
        content: `*${errorMessage}*`,
        is_ai: false,
      }).select();

      if (data && data[0]) {
        setMessages(prev => {
          if (prev.some(m => m.id === data[0].id)) return prev;
          return [...prev, data[0] as Message];
        });
      }
    }

    isGeneratingAI.current = false;
    // Сбрасываем флаг генерации AI в БД
    supabase
      .from('rooms')
      .update({ is_ai_generating: false })
      .eq('id', roomId)
      .then(() => {
        console.log('AI generating flag reset');
      })
      .catch(err => {
        console.error('Failed to reset AI generating flag:', err);
      });
    
    if (!wasLoading) setIsLoading(false);
  };

  return (
    <div className={cn("flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden relative", theme)}>
      {/* Header */}
      <div className="shrink-0 p-2 md:p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md z-30 pt-[calc(0.75rem+env(safe-area-inset-top))] md:pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-1 md:gap-4 min-w-0">
          <button
            onClick={onLeave}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white shrink-0"
            title="Назад в меню"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm md:text-xl font-bold tracking-tight text-primary leading-tight truncate">D&D Темное Фэнтези</h2>
            <div className="flex items-center gap-1 md:gap-2 flex-wrap">
              <p className="text-[9px] md:text-xs text-zinc-500 font-mono uppercase tracking-widest truncate">Комната: {roomId}</p>
              <button
                onClick={copyRoomId}
                className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-primary shrink-0"
                title="Копировать ID комнаты"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
              <span className="text-zinc-700 mx-0.5 hidden md:inline">•</span>
              <p className={cn(
                "text-[9px] md:text-xs font-mono uppercase tracking-widest shrink-0",
                dailyPromptCount >= DAILY_LIMIT ? "text-red-500" : "text-zinc-500"
              )} title="Ответов ИИ за сегодня">
                <span className="hidden md:inline">Запросы: </span>{dailyPromptCount}/{DAILY_LIMIT}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={cycleTheme}
              className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-primary"
              title="Сменить тему"
            >
              <Palette className="w-5 h-5" />
            </button>
            <button
              onClick={togglePause}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border text-[10px] font-bold uppercase tracking-widest ${
                isPaused 
                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' 
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
              {isPaused ? 'Продолжить (RP)' : 'Пауза (NON-RP)'}
            </button>
            <button 
              onClick={() => setIsGalleryOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-widest"
            >
              <Layers className="w-4 h-4 text-primary" />
              Галерея
            </button>
            
            {/* Character Avatar Button */}
            <button 
              onClick={() => setIsStatsOpen(true)}
              className="relative w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 border-2 border-zinc-700 hover:border-primary transition-all flex items-center justify-center text-xl group"
              title={getCurrentPlayerStats()?.name || userName}
            >
              {character ? getAvatarEmoji(character.avatar_icon) : '⚔️'}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-950"></div>
            </button>
          </div>

          {/* User Badge & Player List */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl" title="Лимит запросов на сегодня">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Запросов: <span className={dailyPromptCount >= DAILY_LIMIT ? "text-red-400" : "text-primary"}>{dailyPromptCount}</span> / {DAILY_LIMIT}
              </span>
            </div>
            <div className="flex -space-x-2 overflow-hidden">
              {players.slice(0, 3).map((p, i) => (
                <div 
                  key={i}
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-zinc-900 bg-zinc-800 flex items-center justify-center text-lg"
                  title={p.user}
                >
                  {getAvatarEmoji(character?.avatar_icon)}
                </div>
              ))}
              {players.length > 3 && (
                <div className="flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-zinc-900 bg-zinc-800 text-[10px] font-bold text-zinc-400">
                  +{players.length - 3}
                </div>
              )}
            </div>
            <div className="h-4 w-px bg-zinc-800" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/50 border border-zinc-800 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{userName}</span>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="fixed top-16 right-4 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 md:hidden overflow-hidden"
            >
              <div className="p-2 space-y-1">
                <button
                  onClick={() => { togglePause(); setIsMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                    isPaused ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                  {isPaused ? 'Продолжить (RP)' : 'Пауза (NON-RP)'}
                </button>
                <button
                  onClick={() => { setIsGalleryOpen(true); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                >
                  <Layers className="w-4 h-4 text-primary" />
                  Галерея
                </button>
                <button
                  onClick={() => { setIsStatsOpen(true); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                >
                  <UserIcon className="w-4 h-4 text-primary" />
                  Лист Персонажа
                </button>
                <button
                  onClick={() => { cycleTheme(); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                >
                  <Palette className="w-4 h-4 text-primary" />
                  Сменить тему
                </button>
                <div className="h-px bg-zinc-800 my-1 mx-2" />
                <div className="px-4 py-2 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Активные игроки ({players.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {players.map((p, i) => (
                      <div 
                        key={i} 
                        className="relative w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-lg"
                        title={p.user}
                      >
                        {getAvatarEmoji(p.avatar)}
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-zinc-950"></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-zinc-800 my-1 mx-2" />
                <div className="px-4 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">Лимит на сегодня</span>
                  <span className="text-xs font-mono text-zinc-300">
                    <span className={dailyPromptCount >= DAILY_LIMIT ? "text-red-400" : "text-primary"}>{dailyPromptCount}</span> / {DAILY_LIMIT}
                  </span>
                </div>
                <div className="h-px bg-zinc-800 my-1 mx-2" />
                <div className="px-4 py-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{userName}</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-0 space-y-0 scrollbar-thin scrollbar-thumb-zinc-800 bg-zinc-950 flex flex-col relative"
      >
        {messages.length === 0 && !isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6 opacity-40">
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-full animate-pulse">
              <ScrollText className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-mono uppercase tracking-[0.2em]">Мастер Подземелий молчит</p>
              <button
                onClick={() => triggerAIResponse([])}
                className="px-6 py-2 bg-primary-hover hover:bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary-glow"
              >
                Начать приключение
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-grow min-h-0">
            {(() => {
              let currentPauseState = false;
              const renderableMessages = messages
                .filter(m => m && m.sender_id !== 'gallery-item' && m.sender_id !== 'gallery')
                .map(msg => {
                  if (msg.sender_id === 'system' && msg.content.startsWith('PAUSE:')) {
                    currentPauseState = msg.content === 'PAUSE:TRUE';
                    return { ...msg, isPauseToggle: true, pauseState: currentPauseState };
                  }
                  return { ...msg, isNonRp: currentPauseState };
                });

              return renderableMessages.map((msg, idx) => {
                if (msg.isPauseToggle) {
                  return (
                    <div key={msg.id} className="flex items-center justify-center my-8 opacity-70">
                      <div className="border-b border-primary/30 w-full max-w-[100px] md:max-w-[200px]"></div>
                      <span className="px-4 text-[10px] md:text-xs text-primary font-mono uppercase tracking-widest whitespace-nowrap">
                        {msg.pauseState ? 'Начало NON-RP чата' : 'Конец NON-RP чата'}
                      </span>
                      <div className="border-b border-primary/30 w-full max-w-[100px] md:max-w-[200px]"></div>
                    </div>
                  );
                }

                if (msg.sender_id === 'system' && !msg.isPauseToggle) {
                  return (
                    <div key={msg.id} className="flex items-center justify-center my-6">
                      <span className="px-6 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-mono text-center max-w-2xl">
                        {msg.content.replace(/\*/g, '')}
                      </span>
                    </div>
                  );
                }

                const isDM = msg.is_ai && msg.sender_name === 'Dungeon Master';
                const isVisual = msg.is_ai && msg.sender_name === 'Dungeon Master (Visual)';
                
                if (isDM) {
                  return (
                    <div key={msg.id} className="w-full border-b border-zinc-900/50 bg-gradient-to-b from-zinc-900/20 to-transparent p-6 md:p-12 animate-in fade-in duration-700">
                      <div className="max-w-3xl mx-auto space-y-6">
                        <div className="flex items-center gap-3 opacity-50">
                          <ScrollText className="w-4 h-4 text-primary" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Рассказчик</span>
                        </div>
                        <div className="prose prose-invert prose-primary lg:prose-xl max-w-none font-serif leading-relaxed text-zinc-200 selection:bg-primary/30">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              strong: ({ node, ...props }) => <span className="text-primary-text font-bold" {...props} />,
                              p: ({ node, ...props }) => <p className="mb-6 last:mb-0" {...props} />,
                              li: ({ node, ...props }) => <li className="mb-2" {...props} />,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        <div className="pt-4 flex justify-between items-center opacity-30">
                          <span className="text-[10px] font-mono">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
  
                if (isVisual) {
                  return (
                    <div key={msg.id} className="w-full p-4 md:p-8 animate-in zoom-in-95 duration-500">
                      <div className="max-w-4xl mx-auto">
                        <div className="rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              img: ({ node, ...props }) => (
                                <img 
                                  {...props} 
                                  className="w-full h-auto object-cover aspect-video" 
                                  referrerPolicy="no-referrer" 
                                />
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                }
  
                // Player messages as "bubbles" or "popups"
                const isMine = msg.sender_name === userName;

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "w-full px-2 md:px-4 py-2 md:py-3 flex animate-in slide-in-from-bottom-4 duration-300",
                      isMine ? "justify-end" : "justify-start"
                    )}
                  >
                    <div className={cn(
                      "px-3 md:px-5 py-2 md:py-3 shadow-2xl border max-w-[88%] md:max-w-md relative group",
                      isMine
                        ? "rounded-[1.25rem] rounded-tr-sm md:rounded-[1.5rem] md:rounded-tr-md"
                        : "rounded-[1.25rem] rounded-tl-sm md:rounded-[1.5rem] md:rounded-tl-md",
                      msg.isNonRp
                        ? "bg-zinc-900/80 backdrop-blur-md text-zinc-300 border-primary/20"
                        : (isMine
                            ? "bg-primary-hover/90 backdrop-blur-md text-white border-primary-border"
                            : "bg-zinc-800/90 backdrop-blur-md text-white border-zinc-700")
                    )}>
                      <div className={cn("flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2 opacity-60", isMine ? "flex-row" : "flex-row-reverse justify-end")}>
                        {msg.isNonRp && (
                          <span className="text-[7px] md:text-[8px] border border-primary/30 px-1 md:px-1.5 py-0.5 rounded text-primary/70">NON-RP</span>
                        )}
                        <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest max-w-[120px] md:max-w-none truncate">
                          {msg.sender_name}
                        </span>
                        <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                          <UserIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        </div>
                      </div>
                      <div className={cn("text-[13px] md:text-base lg:text-lg leading-relaxed break-words", msg.isNonRp ? "font-normal text-zinc-400" : "font-medium")}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            strong: ({ node, ...props }) => <span className="font-bold text-white" {...props} />,
                            em: ({ node, ...props }) => <span className="italic opacity-80" {...props} />,
                            p: ({ node, ...props }) => <span {...props} />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      <div className={cn(
                        "absolute -bottom-1.5 opacity-0 group-hover:opacity-100 transition-opacity",
                        isMine ? "-right-1" : "-left-1"
                      )}>
                         <span className="text-[8px] md:text-[9px] bg-zinc-900 border border-zinc-800 px-1.5 md:px-2 py-0.5 rounded-full text-zinc-400 font-mono shadow-lg">
                           {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
        {isAIGenerating && (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-primary/50 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xs font-mono uppercase tracking-[0.3em]">Мастер плетет историю...</span>
          </div>
        )}
        <div ref={messagesEndRef} className="h-24" />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 md:p-4 bg-zinc-900/80 backdrop-blur-md border-t border-zinc-800 z-50 relative">
        <div className="max-w-4xl mx-auto">
          {isPaused && (
            <div className="flex items-center justify-center gap-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-[10px] font-bold uppercase tracking-widest mb-2">
              <span className="animate-pulse">●</span> NON-RP РЕЖИМ АКТИВЕН
            </div>
          )}

          <div className="flex items-center gap-3">
            <TextareaAutosize
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Опишите ваше действие..."
              minRows={1}
              maxRows={5}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-zinc-600 resize-none leading-relaxed self-end"
              onKeyDown={(e) => {
                const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice) {
                  e.preventDefault();
                  if (input.trim() && !isLoading) {
                    sendMessage(input);
                  }
                }
              }}
            />
            
            {/* Кнопки действий */}
            <div className="flex gap-1.5 md:gap-2 shrink-0">
              <button
                onClick={generateSceneImage}
                disabled={isLoading || isGeneratingImage}
                className={cn(
                  "flex items-center justify-center p-2 md:p-3 rounded-xl transition-all border shrink-0 h-[42px] md:h-[46px] w-[42px] md:w-[46px]",
                  isGeneratingImage
                    ? "bg-zinc-800 text-zinc-500 border-zinc-700"
                    : "bg-zinc-800 hover:bg-zinc-700 text-primary border-primary-border hover:shadow-lg hover:shadow-primary-glow"
                )}
                title="Сгенерировать изображение сцены"
              >
                {isGeneratingImage ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <ImageIcon className="w-4 h-4 md:w-5 md:h-5" />}
              </button>

              <button
                onClick={rollDice}
                disabled={isLoading || isRolling}
                className={cn(
                  "flex items-center justify-center p-2 md:p-3 rounded-xl transition-all border shrink-0 h-[42px] md:h-[46px] w-[42px] md:w-[46px]",
                  isRolling
                    ? "bg-zinc-800 text-zinc-500 border-zinc-700"
                    : "bg-zinc-800 hover:bg-zinc-700 text-primary border-primary-border hover:shadow-lg hover:shadow-primary-glow"
                )}
                title="Бросок кубиков"
              >
                {isRolling ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Dices className="w-4 h-4 md:w-5 md:h-5" />}
              </button>

              <button
                onClick={() => triggerAIResponse(messages)}
                disabled={isLoading}
                className="flex items-center justify-center p-2 md:p-3 rounded-xl transition-all border border-primary-border bg-primary/10 hover:bg-primary/20 text-primary hover:shadow-lg hover:shadow-primary-glow shrink-0 h-[42px] md:h-[46px] w-[42px] md:w-[46px] disabled:opacity-50"
                title="Продолжить историю (ИИ)"
              >
                <ScrollText className="w-4 h-4 md:w-5 md:h-5" />
              </button>

              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="flex items-center justify-center p-2 md:p-3 rounded-xl transition-all bg-primary-hover hover:bg-primary disabled:opacity-50 text-white shadow-lg shrink-0 h-[42px] md:h-[46px] w-[42px] md:w-[46px]"
                title="Отправить сообщение (Enter)"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {isImageModalOpen && generatedImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <ImageIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Сгенерированное изображение</h3>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-1 max-w-md">
                    {currentPrompt}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="p-3 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-500 hover:text-white group"
              >
                <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800">
              <div className="relative rounded-2xl overflow-hidden border border-zinc-800">
                <img
                  src={generatedImageUrl}
                  alt={currentPrompt}
                  className="w-full h-auto object-contain max-h-[60vh]"
                />
              </div>
            </div>

            <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-900/50 backdrop-blur-xl">
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="px-6 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-sm font-medium"
              >
                Отмена
              </button>
              <button
                onClick={sendImageToChat}
                disabled={isGeneratingImage}
                className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {isGeneratingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Сохранить в галерею
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Modal */}
      {isGalleryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-6xl h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-in slide-in-from-bottom-8 duration-300">
            <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <Layers className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Adventure Gallery</h3>
                  <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mt-1">
                    {messages.filter(m => m && m.is_ai && m.content && typeof m.content === 'string' && m.content.includes('![')).length} Captured Moments
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsGalleryOpen(false)}
                className="p-3 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-500 hover:text-white group"
              >
                <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-zinc-800">
              {(() => {
                try {
                  // Broaden filter to find ANY image markdown in AI messages
                  const galleryImages = messages.filter(m => 
                    m && 
                    m.content && 
                    typeof m.content === 'string' && 
                    (m.content.includes('data:image') || m.content.includes('![')) &&
                    (m.sender_id === 'gallery-item' || m.sender_id === 'gallery' || m.sender_name.includes('Visual'))
                  );
                  
                  console.log('Gallery images found:', galleryImages.length);
                  
                  if (galleryImages.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                        <ImageIcon className="w-16 h-16 text-zinc-600" />
                        <p className="text-sm font-mono uppercase tracking-[0.2em]">No images captured yet</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {galleryImages.map((m, idx) => {
                        const match = m.content.match(/!\[(.*?)\]\((.*?)\)/);
                        if (!match) return null;
                        
                        const prompt = match[1] || 'Scene';
                        const url = match[2] || '';
                        
                        return (
                          <div key={m.id || idx} className="group relative bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-800 hover:border-primary transition-all duration-500 shadow-xl hover:shadow-primary-glow">
                            <div className="aspect-video relative overflow-hidden">
                              <img 
                                src={url} 
                                alt={prompt} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                                <div className="flex gap-2">
                                  <a 
                                    href={url} 
                                    download={`scene-${idx}.png`}
                                    className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition-colors"
                                    title="Download Image"
                                  >
                                    <Download className="w-5 h-5" />
                                  </a>
                                  <button 
                                    onClick={() => window.open(url, '_blank')}
                                    className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition-colors"
                                    title="View Full Size"
                                  >
                                    <Maximize2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="p-6 space-y-3">
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
                                  Moment #{idx + 1}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-600">
                                  {m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Unknown Date'}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed font-serif italic">
                                "{prompt.replace('...', '')}"
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                } catch (err) {
                  console.error('Gallery Render Error:', err);
                  return <div className="text-red-500 p-4">Ошибка при отображении галереи.</div>;
                }
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Character Stats Modal */}
      {isStatsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          {/* Устанавливаем текущего игрока при открытии */}
          {(() => {
            if (!selectedPlayerForStats && character) {
              setSelectedPlayerForStats(character.name);
            } else if (!selectedPlayerForStats && characterStats) {
              // Если нет character, пробуем найти по userName
              const currentPlayer = Object.keys(characterStats).find(name => 
                name === userName || characterStats[name].name === userName
              );
              if (currentPlayer) setSelectedPlayerForStats(currentPlayer);
            }
            return null;
          })()}
          <div className="max-w-4xl w-full h-[90vh] bg-zinc-900 border border-zinc-800 rounded-[3rem] shadow-2xl flex flex-col overflow-hidden relative">
            {/* Header */}
            <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <UserIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Лист Персонажа</h3>
                  <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mt-1">
                    {getCurrentPlayerStats()?.name || userName} • {getCurrentPlayerStats()?.race || 'Unknown'} {getCurrentPlayerStats()?.class || 'Adventurer'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Selector игроков */}
                {characterStats && Object.keys(characterStats).length > 1 && (
                  <select
                    value={selectedPlayerForStats || character?.name || userName || ''}
                    onChange={(e) => setSelectedPlayerForStats(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {Object.keys(characterStats).map((playerName) => (
                      <option key={playerName} value={playerName}>{playerName}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setIsStatsOpen(false)}
                  className="p-3 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-500 hover:text-white group"
                >
                  <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-zinc-800">
              {!getCurrentPlayerStats() ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <Loader2 className="w-16 h-16 text-zinc-600 animate-spin" />
                  <p className="text-sm font-mono uppercase tracking-[0.2em]">Ждем утверждения персонажа мастером...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Core Info & Stats */}
                  <div className="lg:col-span-1 space-y-6">
                    {/* HP & Level */}
                    <div className="bg-zinc-950/50 border border-zinc-800 p-6 rounded-3xl space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Здоровье (HP)</p>
                          <p className="text-3xl font-black text-white">{getCurrentPlayerStats()!.hp.current} <span className="text-zinc-600 text-xl">/ {getCurrentPlayerStats()!.hp.max}</span></p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Уровень</p>
                          <p className="text-3xl font-black text-primary">{getCurrentPlayerStats()!.level}</p>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: ((getCurrentPlayerStats()!.hp.current / getCurrentPlayerStats()!.hp.max) * 100) + '%' }}
                          className={cn(
                            "h-full transition-all duration-500",
                            (getCurrentPlayerStats()!.hp.current / getCurrentPlayerStats()!.hp.max) < 0.3 ? "bg-red-500" : "bg-primary"
                          )}
                        />
                      </div>
                      <div className="pt-2 flex justify-between items-center">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Опыт (XP)</p>
                        <p className="text-xs font-mono text-zinc-300">{getCurrentPlayerStats()!.xp} XP</p>
                      </div>
                    </div>

                    {/* Ability Scores */}
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(getCurrentPlayerStats()!.stats).map(([key, val]) => {
                        const mod = Math.floor((val - 10) / 2);
                        return (
                          <div key={key} className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-2xl text-center space-y-1 group hover:border-primary-border transition-colors">
                            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{key.substring(0, 3)}</p>
                            <p className="text-xl font-black text-white">{val}</p>
                            <p className={cn("text-[10px] font-bold", mod >= 0 ? "text-primary" : "text-red-500")}>
                              {mod >= 0 ? '+' : ''}{mod}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Middle Column: Background & Equipment */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-zinc-950/50 border border-zinc-800 p-8 rounded-[2.5rem] space-y-6">
                      {getCurrentPlayerStats()!.story_summary && (
                        <>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-primary">
                              <ScrollText className="w-4 h-4" />
                              <h4 className="text-xs font-bold uppercase tracking-widest">Память Мастера (Сводка)</h4>
                            </div>
                            <p className="text-zinc-300 text-sm leading-relaxed font-serif italic border-l-2 border-primary/30 pl-4">
                              {getCurrentPlayerStats()!.story_summary}
                            </p>
                          </div>
                          <div className="h-px bg-zinc-800" />
                        </>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-primary">
                          <BookOpen className="w-4 h-4" />
                          <h4 className="text-xs font-bold uppercase tracking-widest">Предыстория</h4>
                        </div>
                        <p className="text-zinc-300 text-sm leading-relaxed font-serif italic">
                          {getCurrentPlayerStats()!.background}
                        </p>
                      </div>

                      <div className="h-px bg-zinc-800" />

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                          <Briefcase className="w-4 h-4" />
                          <h4 className="text-xs font-bold uppercase tracking-widest">Снаряжение</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {getCurrentPlayerStats()!.equipment.map((item, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl group hover:bg-zinc-800 transition-colors">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
                              <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions / Info */}
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { icon: Shield, label: 'Armor Class', val: 10 + Math.floor((getCurrentPlayerStats()!.stats.dexterity - 10) / 2) },
                        { icon: Zap, label: 'Initiative', val: '+' + Math.floor((getCurrentPlayerStats()!.stats.dexterity - 10) / 2) },
                        { icon: Swords, label: 'Proficiency', val: '+2' }
                      ].map((item, i) => (
                        <div key={i} className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-1">
                          <item.icon className="w-4 h-4 text-zinc-600" />
                          <span className="text-lg font-black text-white">{item.val}</span>
                          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
