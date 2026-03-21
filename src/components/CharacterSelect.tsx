import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Character } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { User, Swords, Shield, Heart, Zap, Brain, Eye, MessageCircle, Plus, Check, Loader2, ArrowLeft, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface CharacterSelectProps {
  userSessionId: string;
  onCharacterSelected: (character: Character, roomId?: string) => void;
  onBack: () => void;
  roomId?: string;
}

export default function CharacterSelect({ userSessionId, onCharacterSelected, onBack, roomId }: CharacterSelectProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [newCharacter, setNewCharacter] = useState({
    name: '',
    race: 'Человек',
    class: 'Воин',
    background: '',
    feat: '',
    customEquipment: '',
    avatar_icon: 'warrior'
  });
  const [pointBuy, setPointBuy] = useState({ strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 });
  const [pointsRemaining, setPointsRemaining] = useState(27);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  const avatarOptions = [{ id: 'warrior', emoji: '⚔️', label: 'Воин' },{ id: 'mage', emoji: '🧙', label: 'Маг' },{ id: 'rogue', emoji: '🗡️', label: 'Плут' },{ id: 'cleric', emoji: '✨', label: 'Клерик' },{ id: 'ranger', emoji: '🏹', label: 'Следопыт' }];

  const races = [
    { name: 'Дворф горный', bonuses: { strength: 2, constitution: 2 } },
    { name: 'Дворф холмовой', bonuses: { constitution: 2, wisdom: 1 } },
    { name: 'Высший эльф', bonuses: { dexterity: 2, intelligence: 1 } },
    { name: 'Лесной эльф', bonuses: { dexterity: 2, wisdom: 1 } },
    { name: 'Дроу', bonuses: { dexterity: 2, charisma: 1 } },
    { name: 'Полурослик легконогий', bonuses: { dexterity: 2, charisma: 1 } },
    { name: 'Полурослик крепкий', bonuses: { constitution: 2, dexterity: 1 } },
    { name: 'Человек', bonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 } },
    { name: 'Человек вариативный', bonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 } },
    { name: 'Драконорожденный', bonuses: { strength: 2, charisma: 1 } },
    { name: 'Гном скальный', bonuses: { intelligence: 2, constitution: 1 } },
    { name: 'Гном лесной', bonuses: { intelligence: 2, dexterity: 1 } },
    { name: 'Полуэльф', bonuses: { charisma: 2, dexterity: 1, constitution: 1 } },
    { name: 'Полуорк', bonuses: { strength: 2, constitution: 1 } },
    { name: 'Тифлинг', bonuses: { intelligence: 1, charisma: 2 } },
  ];

  const classes = [
    { name: 'Варвар', hitDie: 12, equipment: ['Секира двуручная','Метательные топоры (4шт)','Кожаная броня','Рюкзак','Верёвка (15м)','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Бард', hitDie: 8, equipment: ['Рапира','Лютня','Кожаная броня','Рюкзак','Набор для маскировки','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Жрец', hitDie: 8, equipment: ['Булава','Щит','Кольчужная рубаха','Святой символ','Молитвенник','Рюкзак','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Друид', hitDie: 8, equipment: ['Посох','Кожаная броня','Щит','Рюкзак','Травы и компоненты','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Воин', hitDie: 10, equipment: ['Длинный меч','Щит','Кольчужная рубаха','Рюкзак','Верёвка (15м)','Факел (10шт)','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Монах', hitDie: 8, equipment: ['Короткий меч','Дротик (6шт)','Простая одежда','Рюкзак','Верёвка (15м)','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Паладин', hitDie: 10, equipment: ['Длинный меч','Щит','Латная броня','Святой символ','Рюкзак','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Следопыт', hitDie: 10, equipment: ['Длинный лук (20 стрел)','Короткий меч','Кожаная броня','Рюкзак','Верёвка (15м)','Капкан','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Плут', hitDie: 8, equipment: ['Короткий меч','Короткий лук (20 стрел)','Кожаная броня','Воровские инструменты','Рюкзак','Верёвка (15м)','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Чародей', hitDie: 6, equipment: ['Кинжал','Лёгкий арбалет (20 болтов)','Простая одежда','Рюкзак','Компоненты для заклинаний','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Чернокнижник', hitDie: 6, equipment: ['Лёгкий арбалет (20 болтов)','Кинжал','Кожаная броня','Рюкзак','Книга теней','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Волшебник', hitDie: 6, equipment: ['Посох','Книга заклинаний','Мантия','Рюкзак','Компоненты для заклинаний','Чернила и перо','Сухой паёк (10 дней)','Фляга'] },
    { name: 'Изобретатель', hitDie: 8, equipment: ['Лёгкий арбалет (20 болтов)','Кинжал','Кожаная броня','Инструменты изобретателя','Рюкзак','Чернила и перо','Сухой паёк (10 дней)','Фляга'] },
  ];

  useEffect(() => { fetchCharacters(); }, []);
  useEffect(() => { const cost = calculatePointBuyCost(pointBuy); setPointsRemaining(27 - cost); }, [pointBuy]);

  const calculatePointBuyCost = (stats: typeof pointBuy) => { const costTable: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }; return Object.values(stats).reduce((total, value) => total + (costTable[value] || 0), 0); };
  const adjustStat = (stat: keyof typeof pointBuy, delta: number) => { const newValue = pointBuy[stat] + delta; if (newValue < 8 || newValue > 15) return; const newStats = { ...pointBuy, [stat]: newValue }; const newCost = calculatePointBuyCost(newStats); if (newCost <= 27) setPointBuy(newStats); };
  const getFinalStats = () => { const selectedRace = races.find(r => r.name === newCharacter.race); if (!selectedRace) return pointBuy; const final: any = { ...pointBuy }; Object.entries(selectedRace.bonuses).forEach(([stat, bonus]) => { final[stat] = (final[stat] || 0) + bonus; }); return final; };

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
        console.log('🔍 handleSelectCharacter: roomId =', roomId);
        console.log('🔍 handleSelectCharacter: character =', character.name);
        
        // Загружаем актуальные статы из game_sessions
        const { data: session, error: sessionError } = await supabase
          .from('game_sessions')
          .select('character_stats')
          .eq('id', roomId)
          .single();
        
        console.log('📥 Session character_stats:', session?.character_stats);
        console.log('📥 Session error:', sessionError);
        
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
          console.log('✅ Loaded character stats from session:', characterWithStats);
        } else {
          console.log('⚠️ No stats found for', character.name, 'in session');
        }
        
        onCharacterSelected(characterWithStats, roomId);
      } else {
        onCharacterSelected(character);
      }
    } catch (err: any) {
      console.error('Error joining with character:', err);
      setError(err.message);
    } finally {
      setIsJoining(false);
    }
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
      
      // Базовое снаряжение класса + пользовательское
      let equipment = [...(selectedClass?.equipment || [])];
      if (newCharacter.customEquipment.trim()) {
        // Разделяем запятыми или новыми строками
        const customItems = newCharacter.customEquipment.trim().split(/[,\n]+/).map((item: string) => item.trim()).filter((item: string) => item.length > 0);
        equipment = [...equipment, ...customItems];
      }
      
      // Формируем story_summary с чертой
      let storySummary = '';
      if (newCharacter.feat.trim()) {
        storySummary = 'Черта: ' + newCharacter.feat.trim();
      }
      if (newCharacter.background.trim()) {
        storySummary += (storySummary ? '. ' : '') + newCharacter.background.trim();
      }
      
      const { data: character, error: createError } = await supabase.from('characters').insert({
        name: newCharacter.name.trim(),
        race: newCharacter.race,
        class: newCharacter.class,
        background: newCharacter.background.trim() || 'Искатель приключений',
        feat: newCharacter.feat.trim() || null,
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
      setNewCharacter({ name: '', race: 'Человек', class: 'Воин', background: '', feat: '', customEquipment: '', avatar_icon: 'warrior' });
      setPointBuy({ strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 });
    } catch (err: any) {
      console.error('Error creating character:', err);
      setError(err.message);
      setIsJoining(false);
    }
  };

  const handleDeleteCharacter = async (characterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Вы уверены?')) return;
    setDeletingCharacterId(characterId);
    setError(null);
    try {
      await supabase.from('characters').delete().eq('id', characterId);
      setCharacters(prev => prev.filter(c => c.id !== characterId));
      if (currentIndex >= characters.length - 1 && currentIndex > 0) setCurrentIndex(currentIndex - 1);
    } catch (err: any) { console.error('Error deleting character:', err); setError(err.message); } finally { setDeletingCharacterId(null); }
  };

  const goToPrev = () => setCurrentIndex(prev => Math.max(0, prev - 1));
  const goToNext = () => setCurrentIndex(prev => Math.min(characters.length - 1, prev + 1));

  if (isLoading) { return (<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>); }

  const selectedCharacter = characters.find(c => c.id === selectedCharId);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Назад</span></button>
          <h1 className="text-lg font-bold text-primary">Выберите персонажа</h1>
          <div className="w-20" />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Список персонажей */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Персонажи ({characters.length})</h2>
              <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/80 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all"><Plus className="w-4 h-4" />Создать</button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
              {characters.map((char) => (
                <div key={char.id} onClick={() => setSelectedCharId(char.id)} className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedCharId === char.id ? 'bg-primary/10 border-primary' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><span className="text-2xl">{char.avatar_icon === 'warrior' ? '⚔️' : char.avatar_icon === 'mage' ? '🧙' : char.avatar_icon === 'rogue' ? '🗡️' : char.avatar_icon === 'cleric' ? '✨' : '🏹'}</span><div><p className="font-bold text-white">{char.name}</p><p className="text-xs text-zinc-500">{char.race} {char.class} Ур.{char.level}</p></div></div>
                    <div className="flex items-center gap-2">{selectedCharId === char.id && (<Check className="w-5 h-5 text-primary" />)}<button onClick={(e) => handleDeleteCharacter(char.id, e)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-zinc-600 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Детали персонажа */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
            {selectedCharacter && (<><div className="flex items-center gap-3"><span className="text-4xl">{selectedCharacter.avatar_icon === 'warrior' ? '⚔️' : selectedCharacter.avatar_icon === 'mage' ? '🧙' : selectedCharacter.avatar_icon === 'rogue' ? '🗡️' : selectedCharacter.avatar_icon === 'cleric' ? '✨' : '🏹'}</span><div><h3 className="text-xl font-bold text-white">{selectedCharacter.name}</h3><p className="text-sm text-zinc-500">{selectedCharacter.race} {selectedCharacter.class}</p></div></div><div className="grid grid-cols-2 gap-3">{[{ icon: Heart, label: 'HP', value: `${selectedCharacter.hp_current}/${selectedCharacter.hp_max}` },{ icon: Zap, label: 'XP', value: selectedCharacter.xp.toString() },{ icon: Swords, label: 'Уровень', value: selectedCharacter.level.toString() },].map((stat) => (<div key={stat.label} className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl"><div className="flex items-center gap-2 text-zinc-500 mb-1"><stat.icon className="w-4 h-4" /><span className="text-xs uppercase tracking-widest">{stat.label}</span></div><p className="text-lg font-bold text-white">{stat.value}</p></div>))}</div><div className="grid grid-cols-3 gap-2">{[{ key: 'strength', label: 'Сила' },{ key: 'dexterity', label: 'Ловкость' },{ key: 'constitution', label: 'Телосложение' },{ key: 'intelligence', label: 'Интеллект' },{ key: 'wisdom', label: 'Мудрость' },{ key: 'charisma', label: 'Харизма' },].map((s) => (<div key={s.key} className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-center"><p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{s.label}</p><p className="text-sm font-bold text-white">{(selectedCharacter as any)[s.key]}</p></div>))}</div><div className="pt-3 border-t border-zinc-800 space-y-3"><div><p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Предыстория</p><p className="text-sm text-zinc-300">{selectedCharacter.background || 'Не указана'}</p></div>{selectedCharacter.feat && (<div><p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Черта</p><p className="text-sm text-zinc-300">{selectedCharacter.feat}</p></div>)}<div><p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Снаряжение</p><div className="flex flex-wrap gap-2">{selectedCharacter.equipment && selectedCharacter.equipment.length > 0 ? selectedCharacter.equipment.map((item, idx) => (<span key={idx} className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-400">{item}</span>)) : (<span className="text-sm text-zinc-600">Нет снаряжения</span>)}</div></div></div></>)}
            {!selectedCharacter && (<div className="text-center text-zinc-500 py-12"><p>Выберите персонажа</p></div>)}
          </div>
        </div>
      </div>

      {/* Кнопка продолжения */}
      {selectedCharacter && (<div className="border-t border-zinc-800 bg-zinc-900/50 backdrop-blur-xl sticky bottom-0"><div className="max-w-5xl mx-auto px-4 py-4"><button onClick={() => handleSelectCharacter(selectedCharacter)} disabled={isJoining} className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/80 text-white rounded-2xl py-4 font-bold uppercase tracking-widest transition-all disabled:opacity-50">{isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}{roomId ? 'Продолжить приключение' : 'Начать игру'}</button></div></div>)}

      {/* Форма создания */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Создание персонажа</h2>
                <button onClick={() => { setShowCreateForm(false); setNewCharacter({ name: '', race: 'Человек', class: 'Воин', background: '', feat: '', customEquipment: '', avatar_icon: 'warrior' }); setPointBuy({ strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 }); }} className="text-zinc-400 hover:text-white"><span className="text-2xl">×</span></button>
              </div>
              <form onSubmit={handleCreateCharacter} className="p-6 space-y-6">
                <div className="space-y-4">
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Имя</label><input value={newCharacter.name} onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Арагорн" required /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Раса</label><select value={newCharacter.race} onChange={(e) => setNewCharacter({ ...newCharacter, race: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50">{races.map((r) => (<option key={r.name} value={r.name}>{r.name}</option>))}</select></div>
                    <div><label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Класс</label><select value={newCharacter.class} onChange={(e) => setNewCharacter({ ...newCharacter, class: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50">{classes.map((c) => (<option key={c.name} value={c.name}>{c.name}</option>))}</select></div>
                  </div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Предыстория</label><textarea value={newCharacter.background} onChange={(e) => setNewCharacter({ ...newCharacter, background: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" rows={2} placeholder="Искатель приключений..." /></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Черта</label><input value={newCharacter.feat} onChange={(e) => setNewCharacter({ ...newCharacter, feat: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Удачливый, Боевой заклинатель..." /></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Дополнительное снаряжение</label><textarea value={newCharacter.customEquipment} onChange={(e) => setNewCharacter({ ...newCharacter, customEquipment: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" rows={2} placeholder="Зелье лечения, Верёвка, Факел (через запятую)" /></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Аватар</label><div className="flex gap-3">{avatarOptions.map((avatar) => (<button key={avatar.id} type="button" onClick={() => setNewCharacter({ ...newCharacter, avatar_icon: avatar.id })} className={`p-4 rounded-xl border-2 transition-all ${newCharacter.avatar_icon === avatar.id ? 'border-primary bg-primary/10' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'}`} title={avatar.label}><span className="text-3xl block">{avatar.emoji}</span></button>))}</div></div>
                  <div>
                    <div className="flex items-center justify-between mb-3"><label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Характеристики (Point Buy)</label><span className={`text-xs font-bold ${pointsRemaining === 0 ? 'text-green-500' : 'text-amber-500'}`}>Осталось очков: {pointsRemaining}</span></div>
                    <div className="grid grid-cols-3 gap-3">{Object.entries(pointBuy).map(([stat, value]) => (<div key={stat} className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl"><div className="flex items-center justify-between mb-2"><span className="text-xs text-zinc-500 uppercase">{stat === 'strength' ? 'Сила' : stat === 'dexterity' ? 'Ловкость' : stat === 'constitution' ? 'Телосложение' : stat === 'intelligence' ? 'Интеллект' : stat === 'wisdom' ? 'Мудрость' : 'Харизма'}</span><span className="text-sm font-bold text-white">{value}</span></div><div className="flex items-center gap-2"><button type="button" onClick={() => adjustStat(stat as keyof typeof pointBuy, -1)} disabled={value <= 8} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-bold">-</button><div className="flex-1" /><button type="button" onClick={() => adjustStat(stat as keyof typeof pointBuy, 1)} disabled={value >= 15 || pointsRemaining <= 0} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-bold">+</button></div></div>))}</div>
                  </div>
                </div>
                <button type="submit" disabled={isJoining || pointsRemaining !== 0} className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/80 text-white rounded-2xl py-4 font-bold uppercase tracking-widest transition-all disabled:opacity-50">{isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}{pointsRemaining !== 0 ? `Распределите все очки (осталось: ${pointsRemaining})` : 'Создать персонажа'}</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
