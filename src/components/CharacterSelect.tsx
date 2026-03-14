import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Character } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Swords, Shield, Heart, Zap, Brain, Eye, MessageCircle,
  Plus, Check, Lock, Loader2, ArrowLeft, Sparkles, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';

interface CharacterSelectProps {
  userSessionId: string;
  onCharacterSelected: (character: Character, roomId?: string) => void;
  onBack: () => void;
  roomId?: string;
}

export default function CharacterSelect({
  userSessionId,
  onCharacterSelected,
  onBack,
  roomId
}: CharacterSelectProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [occupiedCharacterIds, setOccupiedCharacterIds] = useState<Set<string>>(new Set());
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const charactersPerPage = 6;

  const [newCharacter, setNewCharacter] = useState({
    name: '',
    race: 'Человек',
    class: 'Воин',
    background: '',
    specialItem: '',
    specialItemDescription: '',
    avatar_icon: 'warrior',
  });

  const avatarOptions = [
    { id: 'warrior',  emoji: '⚔️', label: 'Воин'   },
    { id: 'mage',     emoji: '🧙', label: 'Маг'    },
    { id: 'rogue',    emoji: '🗡️', label: 'Плут'   },
    { id: 'cleric',   emoji: '✨', label: 'Клерик' },
    { id: 'ranger',   emoji: '🏹', label: 'Следопыт'},
  ];

  const [pointBuy, setPointBuy] = useState({
    strength: 8,
    dexterity: 8,
    constitution: 8,
    intelligence: 8,
    wisdom: 8,
    charisma: 8,
  });

  const [pointsRemaining, setPointsRemaining] = useState(27);

  const races = [
    { name: 'Человек', bonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 } },
    { name: 'Эльф', bonuses: { dexterity: 2, intelligence: 1 } },
    { name: 'Дварф', bonuses: { constitution: 2, wisdom: 1 } },
    { name: 'Полурослик', bonuses: { dexterity: 2, charisma: 1 } },
    { name: 'Полуорк', bonuses: { strength: 2, constitution: 1 } },
    { name: 'Тифлинг', bonuses: { intelligence: 1, charisma: 2 } },
    { name: 'Драконорожденный', bonuses: { strength: 2, charisma: 1 } },
  ];

  const classes = [
    {
      name: 'Воин',
      hitDie: 10,
      equipment: ['Длинный меч', 'Щит', 'Кольчужная рубаха', 'Рюкзак', 'Верёвка (15м)', 'Факел (10шт)', 'Сухой паёк (10 дней)', 'Фляга']
    },
    {
      name: 'Маг',
      hitDie: 6,
      equipment: ['Посох', 'Книга заклинаний', 'Мантия', 'Рюкзак', 'Компоненты для заклинаний', 'Чернила и перо', 'Сухой паёк (10 дней)', 'Фляга']
    },
    {
      name: 'Плут',
      hitDie: 8,
      equipment: ['Короткий меч', 'Короткий лук (20 стрел)', 'Кожаная броня', 'Воровские инструменты', 'Рюкзак', 'Верёвка (15м)', 'Сухой паёк (10 дней)', 'Фляга']
    },
    {
      name: 'Клерик',
      hitDie: 8,
      equipment: ['Булава', 'Щит', 'Кольчужная рубаха', 'Святой символ', 'Молитвенник', 'Рюкзак', 'Сухой паёк (10 дней)', 'Фляга']
    },
    {
      name: 'Следопыт',
      hitDie: 10,
      equipment: ['Длинный лук (20 стрел)', 'Короткий меч', 'Кожаная броня', 'Рюкзак', 'Верёвка (15м)', 'Капкан', 'Сухой паёк (10 дней)', 'Фляга']
    },
    {
      name: 'Паладин',
      hitDie: 10,
      equipment: ['Длинный меч', 'Щит', 'Латная броня', 'Святой символ', 'Рюкзак', 'Сухой паёк (10 дней)', 'Фляга']
    },
    {
      name: 'Варвар',
      hitDie: 12,
      equipment: ['Секира', 'Метательные топоры (4шт)', 'Кожаная броня', 'Рюкзак', 'Верёвка (15м)', 'Сухой паёк (10 дней)', 'Фляга']
    },
    {
      name: 'Бард',
      hitDie: 8,
      equipment: ['Рапира', 'Лютня', 'Кожаная броня', 'Рюкзак', 'Набор для маскировки', 'Сухой паёк (10 дней)', 'Фляга']
    },
  ];

  useEffect(() => {
    fetchCharacters();
  }, []);

  useEffect(() => {
    const cost = calculatePointBuyCost(pointBuy);
    setPointsRemaining(27 - cost);
  }, [pointBuy]);

  const calculatePointBuyCost = (stats: typeof pointBuy) => {
    const costTable: Record<number, number> = {
      8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
    };

    return Object.values(stats).reduce((total, value) => {
      return total + (costTable[value] || 0);
    }, 0);
  };

  const adjustStat = (stat: keyof typeof pointBuy, delta: number) => {
    const newValue = pointBuy[stat] + delta;
    if (newValue < 8 || newValue > 15) return;

    const newStats = { ...pointBuy, [stat]: newValue };
    const newCost = calculatePointBuyCost(newStats);

    if (newCost <= 27) {
      setPointBuy(newStats);
    }
  };

  const getFinalStats = () => {
    const selectedRace = races.find(r => r.name === newCharacter.race);
    if (!selectedRace) return pointBuy;

    const final: any = { ...pointBuy };
    Object.entries(selectedRace.bonuses).forEach(([stat, bonus]) => {
      final[stat] = (final[stat] || 0) + bonus;
    });

    return final;
  };

  const fetchCharacters = async () => {
    try {
      const { data: chars, error: charsError } = await supabase
        .from('characters')
        .select('*')
        .order('created_at', { ascending: false });

      if (charsError) throw charsError;

      // Если есть roomId, проверяем занятых персонажей
      if (roomId) {
        const { data: participants } = await supabase
          .from('lobby_participants')
          .select('character_id')
          .eq('lobby_id', roomId);

        setOccupiedCharacterIds(new Set(participants?.map(p => p.character_id) || []));
      }

      setCharacters(chars || []);
    } catch (err: any) {
      console.error('Error fetching characters:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCharacter = async (character: Character) => {
    if (occupiedCharacterIds.has(character.id)) return;

    setIsJoining(true);
    setError(null);

    try {
      // Если есть roomId — добавляем участника в лобби
      if (roomId) {
        const { data: existing } = await supabase
          .from('lobby_participants')
          .select('id')
          .eq('lobby_id', roomId)
          .eq('character_id', character.id)
          .single();

        if (existing) {
          setError('Этот персонаж уже занят!');
          setIsJoining(false);
          return;
        }

        await supabase
          .from('lobby_participants')
          .insert({
            lobby_id: roomId,
            character_id: character.id,
            user_session_id: userSessionId,
          });
      }

      // Передаём персонажа и roomId родителю
      onCharacterSelected(character, roomId);
    } catch (err: any) {
      console.error('Error joining with character:', err);
      setError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCharacter.name.trim()) {
      setError('Введите имя персонажа');
      return;
    }

    if (pointsRemaining !== 0) {
      setError(`Распределите все очки характеристик (осталось: ${pointsRemaining})`);
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const selectedClass = classes.find(c => c.name === newCharacter.class);
      const finalStats = getFinalStats();

      const conModifier = Math.floor((finalStats.constitution - 10) / 2);
      const hp_max = (selectedClass?.hitDie || 10) + conModifier;

      const equipment = [...(selectedClass?.equipment || [])];
      if (newCharacter.specialItem.trim()) {
        equipment.push(newCharacter.specialItem.trim());
      }

      const { data: character, error: createError } = await supabase
        .from('characters')
        .insert({
          name: newCharacter.name.trim(),
          race: newCharacter.race,
          class: newCharacter.class,
          background: newCharacter.background.trim() || 'Искатель приключений',
          hp_current: hp_max,
          hp_max: hp_max,
          strength: finalStats.strength,
          dexterity: finalStats.dexterity,
          constitution: finalStats.constitution,
          intelligence: finalStats.intelligence,
          wisdom: finalStats.wisdom,
          charisma: finalStats.charisma,
          equipment: equipment,
          avatar_icon: newCharacter.avatar_icon,
          story_summary: newCharacter.specialItemDescription.trim()
            ? `Особый предмет: ${newCharacter.specialItem}. ${newCharacter.specialItemDescription}`
            : undefined,
        })
        .select()
        .single();

      if (createError) {
        if (createError.code === '23505') {
          setError('Персонаж с таким именем уже существует');
        } else {
          throw createError;
        }
        setIsJoining(false);
        return;
      }

      await handleSelectCharacter(character);
      setShowCreateForm(false);

      setNewCharacter({
        name: '',
        race: 'Человек',
        class: 'Воин',
        background: '',
        specialItem: '',
        specialItemDescription: '',
      });
      setPointBuy({
        strength: 8,
        dexterity: 8,
        constitution: 8,
        intelligence: 8,
        wisdom: 8,
        charisma: 8,
      });
    } catch (err: any) {
      console.error('Error creating character:', err);
      setError(err.message);
      setIsJoining(false);
    }
  };

  const getStatIcon = (stat: string) => {
    switch (stat) {
      case 'strength': return Swords;
      case 'dexterity': return Zap;
      case 'constitution': return Heart;
      case 'intelligence': return Brain;
      case 'wisdom': return Eye;
      case 'charisma': return MessageCircle;
      default: return Shield;
    }
  };

  const getStatModifier = (value: number) => {
    const mod = Math.floor((value - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

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

  const handleDeleteCharacter = async (characterId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Вы уверены, что хотите удалить этого персонажа?')) {
      return;
    }

    setDeletingCharacterId(characterId);
    setError(null);

    try {
      await supabase
        .from('lobby_participants')
        .delete()
        .eq('character_id', characterId);

      await supabase
        .from('characters')
        .delete()
        .eq('id', characterId);

      setCharacters(prev => prev.filter(c => c.id !== characterId));

      const totalPages = Math.ceil((characters.length - 1) / charactersPerPage);
      if (currentPage >= totalPages && currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    } catch (err: any) {
      console.error('Error deleting character:', err);
      setError(err.message);
    } finally {
      setDeletingCharacterId(null);
    }
  };

  const totalPages = Math.ceil(characters.length / charactersPerPage);
  const paginatedCharacters = characters.slice(
    currentPage * charactersPerPage,
    (currentPage + 1) * charactersPerPage
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen">
      {/* Header - фиксированный */}
      <div className="sticky top-0 z-10 bg-zinc-950 p-3 md:p-8 pb-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
              <button
                onClick={onBack}
                className="p-2 md:p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg md:text-3xl font-bold text-white truncate">Выбор персонажа</h1>
                <p className="text-xs md:text-sm text-zinc-500 truncate">
                  {roomId ? `Присоединение к комнате ${roomId}` : 'Создание новой игры'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1 md:gap-2 px-3 md:px-6 py-2 md:py-3 bg-primary-hover hover:bg-primary text-white rounded-xl font-bold transition-all shrink-0 text-xs md:text-base"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden md:inline">Создать персонажа</span>
              <span className="md:hidden">+</span>
            </button>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-sm mt-4"
            >
              {error}
            </motion.div>
          )}
        </div>
      </div>

      {/* Characters Grid - прокручиваемый блок */}
      <div className="px-3 md:px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <AnimatePresence mode="popLayout">
            {paginatedCharacters.map((character) => {
              const isOccupied = occupiedCharacterIds.has(character.id);
              const isSelected = selectedCharacterId === character.id;

              return (
                <motion.div
                  key={character.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`relative bg-zinc-900 border-2 rounded-xl md:rounded-2xl p-3 md:p-6 transition-all ${
                    isOccupied
                      ? 'border-zinc-800 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'border-primary shadow-lg shadow-primary/20'
                      : 'border-zinc-800 hover:border-zinc-700 cursor-pointer'
                  }`}
                  onClick={() => !isOccupied && !isJoining && setSelectedCharacterId(character.id)}
                >
                  {isOccupied && (
                    <div className="absolute top-2 right-2 md:top-4 md:right-4 flex items-center gap-1 md:gap-2 px-2 md:px-3 py-0.5 md:py-1 bg-red-500/20 border border-red-500/30 rounded-full">
                      <Lock className="w-2.5 h-2.5 md:w-3 md:h-3 text-red-400" />
                      <span className="text-[10px] md:text-xs font-bold text-red-400">Занят</span>
                    </div>
                  )}

                  {!isOccupied && (
                    <button
                      onClick={(e) => handleDeleteCharacter(character.id, e)}
                      disabled={deletingCharacterId === character.id}
                      className="absolute top-2 right-2 md:top-4 md:right-4 p-1.5 md:p-2 bg-zinc-800/80 hover:bg-red-500/20 border border-zinc-700 hover:border-red-500/30 rounded-lg transition-all group/delete"
                      title="Удалить персонажа"
                    >
                      {deletingCharacterId === character.id ? (
                        <Loader2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-zinc-500 animate-spin" />
                      ) : (
                        <Trash2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-zinc-500 group-hover/delete:text-red-400 transition-colors" />
                      )}
                    </button>
                  )}

                  <div className="space-y-3 md:space-y-4">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-zinc-800 rounded-full flex items-center justify-center text-2xl md:text-3xl">
                      {getAvatarEmoji(character.avatar_icon)}
                    </div>

                    <div>
                      <h3 className="text-base md:text-xl font-bold text-white truncate">{character.name}</h3>
                      <p className="text-xs md:text-sm text-zinc-500 truncate">
                        {character.race} • {character.class} • Ур. {character.level}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-2">
                      <Heart className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500" />
                      <div className="flex-1 bg-zinc-800 rounded-full h-1.5 md:h-2 overflow-hidden">
                        <div
                          className="bg-red-500 h-full transition-all"
                          style={{ width: `${(character.hp_current / character.hp_max) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] md:text-xs text-zinc-500 whitespace-nowrap">
                        {character.hp_current}/{character.hp_max}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                      {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((stat) => {
                        const Icon = getStatIcon(stat);
                        const value = character[stat as keyof Character] as number;
                        return (
                          <div
                            key={stat}
                            className="flex flex-col items-center gap-0.5 md:gap-1 p-1.5 md:p-2 bg-zinc-800 rounded-lg"
                          >
                            <Icon className="w-2.5 h-2.5 md:w-3 md:h-3 text-zinc-500" />
                            <span className="text-xs md:text-sm font-bold text-white">{value}</span>
                            <span className="text-[9px] md:text-[10px] text-zinc-600">{getStatModifier(value)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {character.background && (
                      <p className="text-[10px] md:text-xs text-zinc-500 italic line-clamp-2">
                        {character.background}
                      </p>
                    )}

                    {!isOccupied && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCharacter(character);
                        }}
                        disabled={isJoining}
                        className="w-full py-2 md:py-3 bg-primary-hover hover:bg-primary text-white rounded-lg md:rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-base"
                      >
                        {isJoining && selectedCharacterId === character.id ? (
                          <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        )}
                        Выбрать
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 py-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`w-10 h-10 rounded-xl font-bold transition-all ${
                    currentPage === i
                      ? 'bg-primary text-white'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Create Character Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => !isJoining && setShowCreateForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
                <div className="space-y-6">
                  <div className="text-center sticky top-0 bg-zinc-900 pb-4 z-10">
                    <div className="inline-flex p-3 bg-primary-bg rounded-2xl mb-4">
                      <Sparkles className="w-6 h-6 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Создать персонажа</h2>
                    <p className="text-sm text-zinc-500 mt-2">Заполните карточку героя по правилам D&D 5e</p>
                  </div>

                  <form onSubmit={handleCreateCharacter} className="space-y-6">
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Имя персонажа *
                      </label>
                      <input
                        type="text"
                        value={newCharacter.name}
                        onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="Например: Арагорн"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                          Раса
                        </label>
                        <select
                          value={newCharacter.race}
                          onChange={(e) => setNewCharacter({ ...newCharacter, race: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {races.map((race) => (
                            <option key={race.name} value={race.name}>{race.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                          Класс
                        </label>
                        <select
                          value={newCharacter.class}
                          onChange={(e) => setNewCharacter({ ...newCharacter, class: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {classes.map((cls) => (
                            <option key={cls.name} value={cls.name}>{cls.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Предыстория
                      </label>
                      <input
                        type="text"
                        value={newCharacter.background}
                        onChange={(e) => setNewCharacter({ ...newCharacter, background: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="Например: Отшельник"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Особый предмет
                      </label>
                      <input
                        type="text"
                        value={newCharacter.specialItem}
                        onChange={(e) => setNewCharacter({ ...newCharacter, specialItem: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="Например: Семейный амулет"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Описание предмета
                      </label>
                      <textarea
                        value={newCharacter.specialItemDescription}
                        onChange={(e) => setNewCharacter({ ...newCharacter, specialItemDescription: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                        rows={3}
                        placeholder="Краткая история или особые свойства"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Аватар
                      </label>
                      <div className="flex gap-2 mt-2">
                        {avatarOptions.map((avatar) => (
                          <button
                            key={avatar.id}
                            type="button"
                            onClick={() => setNewCharacter({ ...newCharacter, avatar_icon: avatar.id })}
                            className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                              newCharacter.avatar_icon === avatar.id
                                ? 'border-primary bg-primary/10'
                                : 'border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            <div className="text-2xl">{avatar.emoji}</div>
                            <div className="text-xs text-zinc-500 mt-1">{avatar.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                          Характеристики (Point Buy)
                        </label>
                        <span className={`text-xs font-bold ${pointsRemaining === 0 ? 'text-green-500' : 'text-amber-500'}`}>
                          Очков осталось: {pointsRemaining}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(pointBuy).map(([stat, value]) => {
                          const Icon = getStatIcon(stat);
                          const statName = stat.charAt(0).toUpperCase() + stat.slice(1);
                          return (
                            <div
                              key={stat}
                              className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl"
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-zinc-500" />
                                <span className="text-xs font-bold text-zinc-400">{statName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => adjustStat(stat as keyof typeof pointBuy, -1)}
                                  className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white font-bold transition-all disabled:opacity-50"
                                  disabled={value <= 8}
                                >
                                  -
                                </button>
                                <span className="text-sm font-bold text-white w-6 text-center">{value}</span>
                                <button
                                  type="button"
                                  onClick={() => adjustStat(stat as keyof typeof pointBuy, 1)}
                                  className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white font-bold transition-all disabled:opacity-50"
                                  disabled={value >= 15}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="sticky bottom-0 bg-zinc-900 pt-4 border-t border-zinc-800">
                      <button
                        type="submit"
                        disabled={isJoining || pointsRemaining !== 0}
                        className="w-full py-4 bg-primary-hover hover:bg-primary text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isJoining ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Check className="w-5 h-5" />
                        )}
                        Создать и продолжить
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}
