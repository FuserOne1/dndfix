import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Character } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { User, Swords, Shield, Heart, Zap, Brain, Eye, MessageCircle, Plus, Check, Loader2, ArrowLeft, Trash2, ChevronLeft, ChevronRight, Sparkles, ScrollText, Skull } from 'lucide-react';

interface CharacterSelectProps {
  userSessionId: string;
  onCharacterSelected: (character: Character, roomId?: string) => void;
  onBack: () => void;
  roomId?: string;
}

type StepName = 'name' | 'race' | 'class' | 'stats' | 'lore' | 'review';

const STEP_LABELS: Record<StepName, string> = {
  name: 'Имя',
  race: 'Раса',
  class: 'Класс',
  stats: 'Статы',
  lore: 'История',
  review: 'Готово',
};

const avatarOptions = [
  { id: 'warrior', emoji: '⚔️', label: 'Воин' },
  { id: 'mage', emoji: '🧙', label: 'Маг' },
  { id: 'rogue', emoji: '🗡️', label: 'Плут' },
  { id: 'cleric', emoji: '✨', label: 'Клерик' },
  { id: 'ranger', emoji: '🏹', label: 'Следопыт' },
];

const races = [
  { name: 'Дворф горный', bonuses: { strength: 2, constitution: 2 }, description: '+2 Телосложение, +2 Сила' },
  { name: 'Дворф холмовой', bonuses: { constitution: 2, wisdom: 1 }, description: '+2 Телосложение, +1 Мудрость' },
  { name: 'Высший эльф', bonuses: { dexterity: 2, intelligence: 1 }, description: '+2 Ловкость, +1 Интеллект' },
  { name: 'Лесной эльф', bonuses: { dexterity: 2, wisdom: 1 }, description: '+2 Ловкость, +1 Мудрость' },
  { name: 'Дроу', bonuses: { dexterity: 2, charisma: 1 }, description: '+2 Ловкость, +1 Харизма' },
  { name: 'Полурослик легконогий', bonuses: { dexterity: 2, charisma: 1 }, description: '+2 Ловкость, +1 Харизма' },
  { name: 'Полурослик крепкий', bonuses: { dexterity: 2, constitution: 1 }, description: '+2 Ловкость, +1 Телосложение' },
  { name: 'Человек', bonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 }, description: '+1 ко всем характеристикам' },
  { name: 'Человек вариативный', bonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 }, extraPoints: 2, description: '+1 к двум характеристикам на выбор' },
  { name: 'Драконорожденный', bonuses: { strength: 2, charisma: 1 }, description: '+2 Сила, +1 Харизма' },
  { name: 'Гном скальный', bonuses: { intelligence: 2, constitution: 1 }, description: '+2 Интеллект, +1 Телосложение' },
  { name: 'Гном лесной', bonuses: { intelligence: 2, dexterity: 1 }, description: '+2 Интеллект, +1 Ловкость' },
  { name: 'Полуэльф', bonuses: { charisma: 2, strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1 }, extraPoints: 1, description: '+2 Харизма, +1 к двум характеристикам на выбор' },
  { name: 'Полуорк', bonuses: { strength: 2, constitution: 1 }, description: '+2 Сила, +1 Телосложение' },
  { name: 'Тифлинг', bonuses: { intelligence: 1, charisma: 2 }, description: '+1 Интеллект, +2 Харизма' },
];

const classes = [
  { name: 'Варвар', hitDie: 12, equipment: ['Секира двуручная','Метательные топоры (4шт)','Кожаная броня','Рюкзак','Верёвка (15м)','Сухой паёк (10 дней)','Фляга'], icon: '🪓' },
  { name: 'Бард', hitDie: 8, equipment: ['Рапира','Лютня','Кожаная броня','Рюкзак','Набор для маскировки','Сухой паёк (10 дней)','Фляга'], icon: '🎵' },
  { name: 'Жрец', hitDie: 8, equipment: ['Булава','Щит','Кольчужная рубаха','Святой символ','Молитвенник','Рюкзак','Сухой паёк (10 дней)','Фляга'], icon: '✨' },
  { name: 'Друид', hitDie: 8, equipment: ['Посох','Кожаная броня','Щит','Рюкзак','Травы и компоненты','Сухой паёк (10 дней)','Фляга'], icon: '🌿' },
  { name: 'Воин', hitDie: 10, equipment: ['Длинный меч','Щит','Кольчужная рубаха','Рюкзак','Верёвка (15м)','Факел (10шт)','Сухой паёк (10 дней)','Фляга'], icon: '⚔️' },
  { name: 'Монах', hitDie: 8, equipment: ['Короткий меч','Дротик (6шт)','Простая одежда','Рюкзак','Верёвка (15м)','Сухой паёк (10 дней)','Фляга'], icon: '🥋' },
  { name: 'Паладин', hitDie: 10, equipment: ['Длинный меч','Щит','Латная броня','Святой символ','Рюкзак','Сухой паёк (10 дней)','Фляга'], icon: '🛡️' },
  { name: 'Следопыт', hitDie: 10, equipment: ['Длинный лук (20 стрел)','Короткий меч','Кожаная броня','Рюкзак','Верёвка (15м)','Капкан','Сухой паёк (10 дней)','Фляга'], icon: '🏹' },
  { name: 'Плут', hitDie: 8, equipment: ['Короткий меч','Короткий лук (20 стрел)','Кожаная броня','Воровские инструменты','Рюкзак','Верёвка (15м)','Сухой паёк (10 дней)','Фляга'], icon: '🗡️' },
  { name: 'Чародей', hitDie: 6, equipment: ['Кинжал','Лёгкий арбалет (20 болтов)','Простая одежда','Рюкзак','Компоненты для заклинаний','Сухой паёк (10 дней)','Фляга'], icon: '🔮' },
  { name: 'Чернокнижник', hitDie: 6, equipment: ['Лёгкий арбалет (20 болтов)','Кинжал','Кожаная броня','Рюкзак','Книга теней','Сухой паёк (10 дней)','Фляга'], icon: '🦇' },
  { name: 'Волшебник', hitDie: 6, equipment: ['Посох','Книга заклинаний','Мантия','Рюкзак','Компоненты для заклинаний','Чернила и перо','Сухой паёк (10 дней)','Фляга'], icon: '📖' },
  { name: 'Изобретатель', hitDie: 8, equipment: ['Лёгкий арбалет (20 болтов)','Кинжал','Кожаная броня','Инструменты изобретателя','Рюкзак','Чернила и перо','Сухой паёк (10 дней)','Фляга'], icon: '⚙️' },
];

const STAT_NAMES: Record<string, string> = { strength: 'Сила', dexterity: 'Ловкость', constitution: 'Телосложение', intelligence: 'Интеллект', wisdom: 'Мудрость', charisma: 'Харизма' };
const STAT_ICONS: Record<string, string> = { strength: '💪', dexterity: '🏃', constitution: '🛡️', intelligence: '🧠', wisdom: '👁️', charisma: '🎭' };

const getAvatarEmoji = (icon: string) => avatarOptions.find(a => a.id === icon)?.emoji || '⚔️';

export default function CharacterSelect({ userSessionId, onCharacterSelected, onBack, roomId }: CharacterSelectProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createStep, setCreateStep] = useState<StepName>('name');
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [newCharacter, setNewCharacter] = useState({
    name: '',
    race: 'Человек',
    class: 'Воин',
    background: '',
    feat: '',
    specialItem: '',
    specialItemDescription: '',
    customEquipment: '',
    gold: 0,
    abilities: '',
    avatar_icon: 'warrior'
  });
  const [pointBuy, setPointBuy] = useState({ strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 });
  const [pointsRemaining, setPointsRemaining] = useState(27);

  const STEPS: StepName[] = ['name', 'race', 'class', 'stats', 'lore', 'review'];

  useEffect(() => { fetchCharacters(); }, []);

  useEffect(() => {
    const selectedRace = races.find(r => r.name === newCharacter.race);
    if (!selectedRace) return;
    const baseStats = { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 };
    const finalStats = { ...baseStats };
    Object.entries(selectedRace.bonuses).forEach(([stat, bonus]) => {
      finalStats[stat] = (finalStats[stat] || 0) + bonus;
    });
    setPointBuy(finalStats);
    setPointsRemaining(27);
  }, [newCharacter.race]);

  useEffect(() => { const cost = calculatePointBuyCost(pointBuy); setPointsRemaining(27 - cost); }, [pointBuy]);

  const calculatePointBuyCost = (stats: typeof pointBuy) => {
    const selectedRace = races.find(r => r.name === newCharacter.race);
    const costTable: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
    let totalCost = 0;
    Object.entries(stats).forEach(([stat, value]) => {
      const raceBonus = selectedRace?.bonuses[stat] || 0;
      const baseWithoutBonus = value - raceBonus;
      totalCost += costTable[baseWithoutBonus] || 0;
    });
    return totalCost;
  };

  const adjustStat = (stat: keyof typeof pointBuy, delta: number) => {
    const selectedRace = races.find(r => r.name === newCharacter.race);
    const raceBonus = selectedRace?.bonuses[stat] || 0;
    const baseValue = 8 + raceBonus;
    const newValue = pointBuy[stat] + delta;
    if (newValue < baseValue) return;
    if (newValue > 15) return;
    const newStats = { ...pointBuy, [stat]: newValue };
    const newCost = calculatePointBuyCost(newStats);
    if (newCost <= 27) setPointBuy(newStats);
  };

  const getFinalStats = () => pointBuy;

  const fetchCharacters = async () => {
    try {
      const { data: chars, error: charsError } = await supabase.from('characters').select('*').order('created_at', { ascending: false });
      if (charsError) throw charsError;
      setCharacters(chars || []);
      if (chars && chars.length > 0 && !selectedCharId) setSelectedCharId(chars[0].id);
    } catch (err: any) { setError(err.message); } finally { setIsLoading(false); }
  };

  const handleSelectCharacter = async (character: Character) => {
    setIsJoining(true);
    setError(null);
    try {
      if (roomId) {
        const { data: session, error: sessionError } = await supabase
          .from('game_sessions')
          .select('character_stats')
          .eq('id', roomId)
          .single();
        let characterWithStats = character;
        if (session?.character_stats?.[character.name]) {
          const sessionStats = session.character_stats[character.name];
          characterWithStats = {
            ...character,
            hp_current: sessionStats.hp?.current || character.hp_current,
            hp_max: sessionStats.hp?.max || character.hp_max,
            level: sessionStats.level || character.level,
            xp: sessionStats.xp || character.xp,
            strength: sessionStats.stats?.strength || character.strength,
            dexterity: sessionStats.stats?.dexterity || character.dexterity,
            constitution: sessionStats.stats?.constitution || character.constitution,
            intelligence: sessionStats.stats?.intelligence || character.intelligence,
            wisdom: sessionStats.stats?.wisdom || character.wisdom,
            charisma: sessionStats.stats?.charisma || character.charisma,
            equipment: sessionStats.equipment || character.equipment,
            story_summary: sessionStats.story_summary || character.story_summary,
          };
        }
        onCharacterSelected(characterWithStats, roomId);
      } else {
        onCharacterSelected(character);
      }
    } catch (err: any) { setError(err.message); } finally { setIsJoining(false); }
  };

  const goToStep = (step: StepName) => {
    const idx = STEPS.indexOf(step);
    const cur = STEPS.indexOf(createStep);
    setDirection(idx > cur ? 1 : -1);
    setCreateStep(step);
  };

  const nextStep = () => {
    const idx = STEPS.indexOf(createStep);
    if (idx < STEPS.length - 1) { setDirection(1); setCreateStep(STEPS[idx + 1]); }
  };

  const prevStep = () => {
    const idx = STEPS.indexOf(createStep);
    if (idx > 0) { setDirection(-1); setCreateStep(STEPS[idx - 1]); }
  };

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharacter.name.trim()) { setError('Введите имя персонажа'); return; }
    if (pointsRemaining !== 0) { setError('Распределите все очки (осталось: ' + pointsRemaining + ')'); return; }
    setIsJoining(true);
    setError(null);
    try {
      const selectedClass = classes.find(c => c.name === newCharacter.class);
      const finalStats = getFinalStats();
      const conModifier = Math.floor((finalStats.constitution - 10) / 2);
      const hp_max = (selectedClass?.hitDie || 10) + conModifier;
      let equipment = [...(selectedClass?.equipment || [])];
      if (newCharacter.customEquipment.trim()) {
        const customItems = newCharacter.customEquipment.trim().split(/[,\n]+/).map((item: string) => item.trim()).filter((item: string) => item.length > 0);
        equipment = [...equipment, ...customItems];
      }
      let storySummary = '';
      if (newCharacter.feat.trim()) storySummary = 'Черта: ' + newCharacter.feat.trim();
      if (newCharacter.specialItem.trim()) {
        storySummary += (storySummary ? '. ' : '') + 'Особый предмет: ' + newCharacter.specialItem.trim();
        if (newCharacter.specialItemDescription.trim()) storySummary += ' (' + newCharacter.specialItemDescription.trim() + ')';
      }
      if (newCharacter.background.trim()) storySummary += (storySummary ? '. ' : '') + newCharacter.background.trim();
      const { data: character, error: createError } = await supabase.from('characters').insert({
        name: newCharacter.name.trim(),
        race: newCharacter.race,
        class: newCharacter.class,
        background: newCharacter.background.trim() || 'Искатель приключений',
        feat: newCharacter.feat.trim() || null,
        special_item: newCharacter.specialItem.trim() || null,
        special_item_description: newCharacter.specialItemDescription.trim() || null,
        gold: newCharacter.gold || 0,
        abilities: newCharacter.abilities.trim() || null,
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
        story_summary: storySummary || undefined,
      }).select().single();
      if (createError) {
        if (createError.code === '23505') setError('Персонаж с таким именем уже существует');
        else throw createError;
        setIsJoining(false);
        return;
      }
      await handleSelectCharacter(character);
      setShowCreateForm(false);
      setNewCharacter({ name: '', race: 'Человек', class: 'Воин', background: '', feat: '', specialItem: '', specialItemDescription: '', customEquipment: '', gold: 0, abilities: '', avatar_icon: 'warrior' });
      setPointBuy({ strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 });
    } catch (err: any) { setError(err.message); setIsJoining(false); }
  };

  const handleDeleteCharacter = async (characterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Вы уверены?')) return;
    setDeletingCharacterId(characterId);
    setError(null);
    try {
      await supabase.from('characters').delete().eq('id', characterId);
      setCharacters(prev => prev.filter(c => c.id !== characterId));
    } catch (err: any) { setError(err.message); } finally { setDeletingCharacterId(null); }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <div className="absolute inset-0 animate-ping w-10 h-10 rounded-full bg-primary/20" />
        </div>
        <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest animate-pulse">Загрузка героев...</p>
      </div>
    </div>
  );

  const selectedCharacter = characters.find(c => c.id === selectedCharId);

  // ======================================================================
  // CREATE FORM — step wizard
  // ======================================================================

  const renderCreateForm = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="bg-zinc-900/90 border border-zinc-800/60 rounded-[1.75rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl backdrop-blur-2xl relative"
      >
        {/* Runic side decorations */}
        <div className="absolute left-0 top-12 bottom-12 w-px bg-gradient-to-b from-transparent via-primary/10 to-transparent pointer-events-none" />
        <div className="absolute right-0 top-12 bottom-12 w-px bg-gradient-to-b from-transparent via-primary/10 to-transparent pointer-events-none" />
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-800/50 px-5 md:px-6 py-4 flex items-center justify-between z-10 rounded-t-[1.75rem]">
          <div className="flex items-center gap-3">
            {createStep !== 'name' ? (
              <button onClick={prevStep} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all">
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => setShowCreateForm(false)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-sm font-bold text-white">Создание героя</h2>
              <p className="text-[9px] text-zinc-600 font-mono">{STEP_LABELS[createStep]}</p>
            </div>
          </div>
          <button onClick={() => { setShowCreateForm(false); setCreateStep('name'); }}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-all">
            <span className="text-lg leading-none">×</span>
          </button>
        </div>

        {/* Steps indicator — rune dots */}
        <div className="flex items-center justify-center gap-1.5 px-5 md:px-6 pt-4 pb-2">
          {STEPS.map((s, i) => {
            const isActive = STEPS.indexOf(createStep) === i;
            const isDone = STEPS.indexOf(createStep) > i;
            return (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`relative transition-all duration-300 ${
                  isActive ? 'scale-125' : ''
                }`}>
                  <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    isActive
                      ? 'bg-primary shadow-md shadow-primary/50 animate-pulse'
                      : isDone
                        ? 'bg-primary/50'
                        : 'bg-zinc-700'
                  }`} />
                  {isActive && (
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping bg-primary/30" />
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-5 h-px transition-all duration-300 ${
                    isDone ? 'bg-primary/40' : 'bg-zinc-800'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleCreateCharacter}>
          <div className="px-5 md:px-6 py-4 min-h-[300px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={createStep}
                initial={{ x: direction * 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction * -30, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* STEP 1: Name + Avatar */}
                {createStep === 'name' && (
                  <div className="space-y-5">
                    <div className="text-center space-y-2">
                      <div className="inline-flex p-2 rounded-xl bg-primary/5 border border-primary/10 mb-1">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-lg font-black text-white tracking-tight">Кто ты, путник?</p>
                      <p className="text-[10px] text-zinc-500">Назови своё имя и выбери образ</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Имя героя</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                        <input value={newCharacter.name} onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                          className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all placeholder:text-zinc-700"
                          placeholder="Арагорн" autoFocus />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Образ</label>
                      <div className="grid grid-cols-5 gap-2">
                        {avatarOptions.map((av) => (
                          <button key={av.id} type="button" onClick={() => setNewCharacter({ ...newCharacter, avatar_icon: av.id })}
                            className={`p-3 rounded-xl border-2 transition-all ${
                              newCharacter.avatar_icon === av.id
                                ? 'border-primary bg-primary/10 shadow-sm shadow-primary/20'
                                : 'border-zinc-800/60 bg-zinc-950/50 hover:border-zinc-600'
                            }`} title={av.label}>
                            <span className="text-2xl block mb-1">{av.emoji}</span>
                            <span className="text-[7px] text-zinc-500 uppercase tracking-wider">{av.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Race */}
                {createStep === 'race' && (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <span className="text-2xl block">🏰</span>
                      <p className="text-lg font-black text-white tracking-tight">Выбери расу</p>
                      <p className="text-[10px] text-zinc-500">Кровь определяет судьбу</p>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                      {races.map((r) => (
                        <button key={r.name} type="button" onClick={() => setNewCharacter({ ...newCharacter, race: r.name })}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                            newCharacter.race === r.name
                              ? 'border-primary/50 bg-primary/10 shadow-sm shadow-primary/10'
                              : 'border-zinc-800/40 bg-zinc-950/30 hover:border-zinc-700'
                          }`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                            newCharacter.race === r.name ? 'bg-primary/20 text-primary' : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            {r.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{r.name}</p>
                            <p className="text-[9px] text-primary/70">{r.description}</p>
                          </div>
                          {newCharacter.race === r.name && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 3: Class */}
                {createStep === 'class' && (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <span className="text-2xl block">⚔️</span>
                      <p className="text-lg font-black text-white tracking-tight">Избери путь</p>
                      <p className="text-[10px] text-zinc-500">Класс определяет твои возможности</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                      {classes.map((c) => (
                        <button key={c.name} type="button" onClick={() => setNewCharacter({ ...newCharacter, class: c.name })}
                          className={`p-2.5 rounded-xl border transition-all text-left ${
                            newCharacter.class === c.name
                              ? 'border-primary/50 bg-primary/10 shadow-sm shadow-primary/10'
                              : 'border-zinc-800/40 bg-zinc-950/30 hover:border-zinc-700'
                          }`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-lg">{c.icon}</span>
                            <span className="text-xs font-bold text-white">{c.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Heart className="w-2.5 h-2.5 text-red-400" />
                            <span className="text-[8px] text-zinc-500">Кость ХП: d{c.hitDie}</span>
                          </div>
                          {newCharacter.class === c.name && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {c.equipment.slice(0, 3).map((eq, i) => (
                                <span key={i} className="text-[7px] px-1 py-0.5 bg-zinc-800 rounded text-zinc-500">{eq}</span>
                              ))}
                              {c.equipment.length > 3 && <span className="text-[7px] text-zinc-600">+{c.equipment.length - 3}</span>}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 4: Stats */}
                {createStep === 'stats' && (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <div className="inline-flex p-2 rounded-xl bg-primary/5 border border-primary/10 mb-1">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-lg font-black text-white tracking-tight">Распредели статы</p>
                      <p className="text-[10px] text-zinc-500">Point Buy: 27 очков</p>
                    </div>
                    <div className="flex items-center justify-center gap-1 mb-3">
                      <span className={`text-xs font-bold ${pointsRemaining === 0 ? 'text-green-500' : 'text-amber-500'}`}>
                        {pointsRemaining === 0 ? '✓ Все очки распределены' : `Осталось: ${pointsRemaining}`}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(Object.keys(pointBuy) as (keyof typeof pointBuy)[]).map((stat) => {
                        const raceBonus = races.find(r => r.name === newCharacter.race)?.bonuses[stat] || 0;
                        const val = pointBuy[stat];
                        const mod = Math.floor((val - 10) / 2);
                        const pct = ((val - 8) / 7) * 100;
                        return (
                          <div key={stat} className="flex items-center gap-2">
                            <div className="w-20 shrink-0">
                              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider leading-tight">{STAT_NAMES[stat]}</p>
                              <p className="text-[8px] text-zinc-700">{raceBonus > 0 ? `+${raceBonus}` : ''}</p>
                            </div>
                            <div className="flex-1 relative h-6 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800/60">
                              <div className="absolute inset-0 flex items-center justify-between px-2 z-10">
                                <span className={`text-xs font-black ${val >= 14 ? 'text-primary' : val >= 12 ? 'text-zinc-300' : 'text-zinc-500'}`}>{val}</span>
                                <span className="text-[9px] text-zinc-600 font-mono">{mod >= 0 ? '+' : ''}{mod}</span>
                              </div>
                              <div className="h-full bg-gradient-to-r from-primary/5 to-primary/20 rounded-lg transition-all duration-300" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button type="button" onClick={() => adjustStat(stat, -1)} disabled={val <= 8 + raceBonus}
                                className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white font-bold text-xs transition-all flex items-center justify-center">−</button>
                              <button type="button" onClick={() => adjustStat(stat, 1)} disabled={val >= 15 || pointsRemaining <= 0}
                                className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white font-bold text-xs transition-all flex items-center justify-center">+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="p-2.5 bg-primary/5 border border-primary/10 rounded-xl">
                      <p className="text-[8px] text-primary/60 font-bold uppercase tracking-widest mb-1">Бонусы расы ({newCharacter.race})</p>
                      <p className="text-[10px] text-zinc-400">{races.find(r => r.name === newCharacter.race)?.description || ''}</p>
                    </div>
                  </div>
                )}

                {/* STEP 5: Lore */}
                {createStep === 'lore' && (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <div className="inline-flex p-2 rounded-xl bg-primary/5 border border-primary/10 mb-1">
                        <ScrollText className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-lg font-black text-white tracking-tight">История героя</p>
                      <p className="text-[10px] text-zinc-500">Что привело тебя сюда?</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Предыстория</label>
                      <textarea value={newCharacter.background} onChange={(e) => setNewCharacter({ ...newCharacter, background: e.target.value })}
                        className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-zinc-700 resize-none"
                        rows={2} placeholder="Сирота из тёмного леса..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Черта</label>
                        <input value={newCharacter.feat} onChange={(e) => setNewCharacter({ ...newCharacter, feat: e.target.value })}
                          className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-zinc-700"
                          placeholder="Удачливый" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Золото</label>
                        <input type="number" value={newCharacter.gold} onChange={(e) => setNewCharacter({ ...newCharacter, gold: parseInt(e.target.value) || 0 })}
                          className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-zinc-700" min="0" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Особый предмет</label>
                      <input value={newCharacter.specialItem} onChange={(e) => setNewCharacter({ ...newCharacter, specialItem: e.target.value })}
                        className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-zinc-700"
                        placeholder="Амулет предков" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Описание предмета</label>
                      <textarea value={newCharacter.specialItemDescription} onChange={(e) => setNewCharacter({ ...newCharacter, specialItemDescription: e.target.value })}
                        className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-zinc-700 resize-none"
                        rows={2} placeholder="Древняя семейная реликвия..." />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Способности</label>
                      <textarea value={newCharacter.abilities} onChange={(e) => setNewCharacter({ ...newCharacter, abilities: e.target.value })}
                        className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-zinc-700 resize-none"
                        rows={2} placeholder="Ярость 2/день, заговоры..." />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Доп. снаряжение</label>
                      <textarea value={newCharacter.customEquipment} onChange={(e) => setNewCharacter({ ...newCharacter, customEquipment: e.target.value })}
                        className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-zinc-700 resize-none"
                        rows={1} placeholder="Зелье лечения, верёвка (через запятую)" />
                    </div>
                  </div>
                )}

                {/* STEP 6: Review */}
                {createStep === 'review' && (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <div className="inline-flex p-2 rounded-xl bg-primary/5 border border-primary/10 mb-1">
                        <Skull className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-lg font-black text-white tracking-tight">Готов к приключению?</p>
                      <p className="text-[10px] text-zinc-500">Проверь своего героя</p>
                    </div>
                    <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{getAvatarEmoji(newCharacter.avatar_icon)}</span>
                        <div>
                          <p className="text-base font-black text-white">{newCharacter.name || 'Безымянный'}</p>
                          <p className="text-xs text-zinc-500">{newCharacter.race} {newCharacter.class}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(Object.keys(pointBuy) as (keyof typeof pointBuy)[]).map((stat) => (
                          <div key={stat} className="p-2 bg-zinc-900/50 rounded-xl text-center">
                            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{STAT_NAMES[stat]}</p>
                            <p className="text-sm font-black text-white">{pointBuy[stat]}</p>
                            <p className="text-[8px] text-zinc-600">{Math.floor((pointBuy[stat] - 10) / 2) >= 0 ? '+' : ''}{Math.floor((pointBuy[stat] - 10) / 2)}</p>
                          </div>
                        ))}
                      </div>
                      {newCharacter.background && (
                        <p className="text-[10px] text-zinc-400 italic leading-relaxed">«{newCharacter.background}»</p>
                      )}
                    </div>
                    {error && (
                      <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-[10px] text-red-400 text-center">{error}</p>
                      </div>
                    )}
                    <button type="submit" disabled={isJoining || pointsRemaining !== 0 || !newCharacter.name.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/80 text-white rounded-2xl py-3.5 font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-primary/20">
                      {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {pointsRemaining !== 0 ? `Осталось очков: ${pointsRemaining}` : 'Воплотить героя'}
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer buttons */}
          {createStep !== 'review' && (
            <div className="sticky bottom-0 bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800/50 px-5 md:px-6 py-3 flex items-center justify-between rounded-b-[1.75rem]">
              <div />
              {createStep === 'stats' && pointsRemaining !== 0 ? (
                <p className="text-[10px] text-amber-500/80">Распредели все очки</p>
              ) : createStep === 'name' && !newCharacter.name.trim() ? (
                <p className="text-[10px] text-zinc-500">Введи имя</p>
              ) : (
                <button type="button" onClick={nextStep}
                  className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/80 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                  Далее
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </form>
      </motion.div>
    </motion.div>
  );

  // ======================================================================
  // MAIN CHARACTER SELECT SCREEN
  // ======================================================================

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans overflow-hidden relative">
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/15 rounded-full"
            style={{
              left: `${10 + i * 15}%`,
              bottom: '-2%',
              animation: `float-up-${(i % 3) + 1} ${15 + i * 4}s ${i * 4}s linear infinite`,
              '--dur': `${15 + i * 4}s`,
              '--delay': `${i * 4}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>
      {/* Ambient glow overlay */}
      <div className="absolute top-0 left-1/4 right-1/4 h-64 bg-gradient-to-b from-primary-bg/20 via-primary-bg/5 to-transparent pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-primary-bg/10 to-transparent pointer-events-none z-0" />

      {/* Header */}
      <div className="border-b border-zinc-800/50 bg-zinc-900/40 backdrop-blur-xl sticky top-0 z-10 relative">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-all group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-widest">Назад</span>
          </button>
          <div className="flex items-center gap-2">
            <Swords className="w-3.5 h-3.5 text-primary" />
            <h1 className="text-sm font-bold text-primary tracking-tight">Выбор героя</h1>
          </div>
          <div className="w-20" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto relative z-[1]">
        <div className="max-w-lg w-full">
          {characters.length === 0 ? (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-6 py-12"
            >
              <div className="inline-flex p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-3xl">
                <Skull className="w-10 h-10 text-zinc-600" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-black text-white tracking-tight">Ещё нет героев</p>
                <p className="text-xs text-zinc-500">Создай своего первого персонажа</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setShowCreateForm(true); setCreateStep('name'); setError(null); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4" />
                Создать героя
              </motion.button>
            </motion.div>
          ) : (
            /* Character cards */
            <div className="space-y-4">
                  <div className="relative">
                {/* Carousel */}
                <div className="overflow-hidden rounded-2xl">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedCharId}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.2 }}
                      className="bg-gradient-to-b from-zinc-900/50 to-zinc-950/30 border border-zinc-800/50 rounded-2xl p-5 md:p-6 space-y-4 shadow-xl shadow-black/20 relative"
                    >
                      {/* Decorative top glow */}
                      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                      {selectedCharacter && (
                        <>
                          {/* Portrait row */}
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-zinc-950 border border-zinc-800/60 flex items-center justify-center text-3xl md:text-4xl">
                                {getAvatarEmoji(selectedCharacter.avatar_icon)}
                              </div>
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary/20 rounded-full flex items-center justify-center">
                                <span className="text-[7px] font-black text-primary">{selectedCharacter.level}</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg md:text-xl font-black text-white tracking-tight truncate">{selectedCharacter.name}</h3>
                              <p className="text-xs text-zinc-500">{selectedCharacter.race} · {selectedCharacter.class}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <div className="flex items-center gap-1">
                                  <Heart className="w-3 h-3 text-red-400" />
                                  <span className="text-[10px] font-bold text-zinc-300">{selectedCharacter.hp_current}/{selectedCharacter.hp_max}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Zap className="w-3 h-3 text-amber-400" />
                                  <span className="text-[10px] font-bold text-zinc-300">{selectedCharacter.xp} XP</span>
                                </div>
                              </div>
                            </div>
                            <button onClick={(e) => handleDeleteCharacter(selectedCharacter.id, e)}
                              className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-zinc-600 hover:text-red-500 shrink-0"
                              title="Удалить">
                              {deletingCharacterId === selectedCharacter.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* Stats grid */}
                          <div className="grid grid-cols-6 gap-1.5">
                            {(Object.keys(pointBuy) as (keyof typeof pointBuy)[]).map((stat) => {
                              const val = (selectedCharacter as any)[stat] || 8;
                              const mod = Math.floor((val - 10) / 2);
                              return (
                                <div key={stat} className="p-1.5 bg-zinc-950/50 border border-zinc-800/40 rounded-lg text-center">
                                  <p className="text-[8px] text-zinc-600 uppercase tracking-wider">{STAT_NAMES[stat].slice(0, 4)}</p>
                                  <p className="text-xs font-black text-white">{val}</p>
                                  <p className="text-[8px] text-zinc-500">{mod >= 0 ? '+' : ''}{mod}</p>
                                </div>
                              );
                            })}
                          </div>

                          {/* Biography */}
                          {selectedCharacter.background && (
                            <div className="p-2.5 bg-zinc-950/30 border border-zinc-800/30 rounded-xl">
                              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Предыстория</p>
                              <p className="text-[10px] text-zinc-400 italic leading-relaxed">«{selectedCharacter.background}»</p>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Navigation arrows */}
                {characters.length > 1 && (
                  <>
                    <button onClick={() => {
                      const idx = characters.findIndex(c => c.id === selectedCharId);
                      const prev = idx > 0 ? idx - 1 : characters.length - 1;
                      setSelectedCharId(characters[prev].id);
                    }} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-zinc-900/80 border border-zinc-800/50 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all z-10">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => {
                      const idx = characters.findIndex(c => c.id === selectedCharId);
                      const next = idx < characters.length - 1 ? idx + 1 : 0;
                      setSelectedCharId(characters[next].id);
                    }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-zinc-900/80 border border-zinc-800/50 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all z-10">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Dots indicator */}
                {characters.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    {characters.map((c) => (
                      <button key={c.id} onClick={() => setSelectedCharId(c.id)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                          c.id === selectedCharId ? 'bg-primary scale-125' : 'bg-zinc-700 hover:bg-zinc-600'
                        }`} />
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom actions */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setShowCreateForm(true); setCreateStep('name'); setError(null); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-700/50 hover:border-zinc-600/50 rounded-2xl text-xs font-bold uppercase tracking-widest text-zinc-400 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Новый герой
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => selectedCharacter && handleSelectCharacter(selectedCharacter)}
                  disabled={isJoining || !selectedCharacter}
                  className="flex-[2] flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/80 disabled:opacity-30 text-white rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/20"
                >
                  {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                  {roomId ? 'Войти в приключение' : 'Начать игру'}
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create form overlay */}
      <AnimatePresence>
        {showCreateForm && renderCreateForm()}
      </AnimatePresence>
    </div>
  );
}
