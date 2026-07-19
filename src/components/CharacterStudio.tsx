import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Character } from '../types';
import { ATTRIBUTE_LABELS, CLASSES, LINEAGES, ORIGINS, getClassDefinition, getLineage, getOrigin } from '../game/catalog';
import { BackstoryAnswers, suggestBackstories } from '../game/backstory-helper';
import { AttributeKey, BackstoryData } from '../game/types';
import { AttributeScores, BASE_SCORES, POINT_BUY_BUDGET, applyLineageBonuses, buildCharacterDraft, pointBuyCost } from '../game/rules';

interface CharacterStudioProps {
  onSelect: (character: Character) => void;
  onBack: () => void;
  title?: string;
}

type Step = 'identity' | 'lineage' | 'class' | 'origin' | 'attributes' | 'skills' | 'story' | 'review';
const STEPS: Step[] = ['identity', 'lineage', 'class', 'origin', 'attributes', 'skills', 'story', 'review'];
const STEP_LABELS: Record<Step, string> = { identity: 'Герой', lineage: 'Наследие', class: 'Путь', origin: 'Происхождение', attributes: 'Характеристики', skills: 'Навыки', story: 'Предыстория', review: 'Итог' };

const EMPTY_ANSWERS: BackstoryAnswers = { homeland: '', goal: '', loss: '', connection: '', fear: '', secret: '', tone: 'dramatic' };
const EMPTY_BACKSTORY: BackstoryData = { homeland: '', goal: '', loss: '', connection: '', fear: '', secret: '', values: [], hooks: [], prose: '' };

export default function CharacterStudio({ onSelect, onBack, title = 'Выберите героя' }: CharacterStudioProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [view, setView] = useState<'library' | 'create'>('library');
  const [step, setStep] = useState<Step>('identity');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [lineageId, setLineageId] = useState('human');
  const [classId, setClassId] = useState('vanguard');
  const [originId, setOriginId] = useState('wanderer');
  const [scores, setScores] = useState<AttributeScores>({ ...BASE_SCORES });
  const [skills, setSkills] = useState<string[]>([]);
  const [answers, setAnswers] = useState<BackstoryAnswers>({ ...EMPTY_ANSWERS });
  const [backstory, setBackstory] = useState<BackstoryData>({ ...EMPTY_BACKSTORY });
  const [variants, setVariants] = useState<BackstoryData[]>([]);
  const [generatingStory, setGeneratingStory] = useState(false);

  useEffect(() => { void loadCharacters(); }, []);

  const classDefinition = getClassDefinition(classId);
  const lineage = getLineage(lineageId);
  const origin = getOrigin(originId);
  const spent = pointBuyCost(scores);
  const finalScores = applyLineageBonuses(scores, lineageId);
  const stepIndex = STEPS.indexOf(step);
  const availableSkills = classDefinition.availableSkills.filter(skill => !origin.skills.includes(skill));

  async function loadCharacters() {
    setLoading(true);
    const { data, error: loadError } = await supabase.from('characters').select('*').order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    setCharacters((data || []) as Character[]);
    setLoading(false);
  }

  function resetCreator() {
    setStep('identity'); setName(''); setLineageId('human'); setClassId('vanguard'); setOriginId('wanderer');
    setScores({ ...BASE_SCORES }); setSkills([]); setAnswers({ ...EMPTY_ANSWERS }); setBackstory({ ...EMPTY_BACKSTORY }); setVariants([]); setError('');
  }

  function openCreator() { resetCreator(); setView('create'); }

  function changeScore(key: AttributeKey, delta: number) {
    setScores(previous => {
      const nextValue = previous[key] + delta;
      if (nextValue < 8 || nextValue > 15) return previous;
      const next = { ...previous, [key]: nextValue };
      return pointBuyCost(next) <= POINT_BUY_BUDGET ? next : previous;
    });
  }

  function canContinue(): boolean {
    if (step === 'identity') return name.trim().length >= 2;
    if (step === 'attributes') return spent === POINT_BUY_BUDGET;
    if (step === 'skills') return skills.length === classDefinition.skillChoices;
    if (step === 'story') return backstory.prose.trim().length >= 20;
    return true;
  }

  function nextStep() {
    if (!canContinue()) { setError(step === 'attributes' ? `Распределите все очки: осталось ${POINT_BUY_BUDGET - spent}` : 'Заполните обязательные данные этапа.'); return; }
    setError('');
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  }

  async function generateStories() {
    setGeneratingStory(true); setError('');
    const suggestions = await suggestBackstories({ name: name.trim(), lineage: lineage.name, className: classDefinition.name, origin: origin.name, answers });
    setVariants(suggestions); setBackstory(suggestions[0]); setGeneratingStory(false);
  }

  async function saveCharacter() {
    setSaving(true); setError('');
    const draft = buildCharacterDraft({ name, lineageId, classId, originId, scores, skills, backstory, avatarIcon: classId });
    const insertPayload: Record<string, unknown> = { ...draft };
    const payload: Record<string, unknown> = { ...insertPayload };
    const omittedFields: Record<string, unknown> = {};
    const optionalColumns = new Set(['rules_data', 'backstory_data', 'gold', 'story_summary', 'avatar_icon']);
    let data: Character | null = null;
    let saveError: { message: string } | null = null;

    for (let attempt = 0; attempt <= optionalColumns.size; attempt += 1) {
      const result = await supabase.from('characters').insert(payload).select().single();
      saveError = result.error;
      if (!saveError && result.data) {
        data = { ...result.data, ...omittedFields } as Character;
        break;
      }

      const missingColumn = saveError?.message.match(/Could not find the '([^']+)' column/i)?.[1];
      if (!missingColumn || !optionalColumns.has(missingColumn) || !(missingColumn in payload)) break;
      omittedFields[missingColumn] = payload[missingColumn];
      delete payload[missingColumn];
    }
    if (saveError || !data) { setError(saveError?.message || 'Не удалось создать героя'); setSaving(false); return; }
    const character = data as Character;
    setCharacters(previous => [character, ...previous]);
    setSaving(false);
    onSelect(character);
  }

  async function deleteCharacter(character: Character) {
    if (!window.confirm(`Удалить героя «${character.name}»?`)) return;
    const { error: deleteError } = await supabase.from('characters').delete().eq('id', character.id);
    if (deleteError) {
      const linkedToCampaign = deleteError.code === '23503' || /campaign_participants_character_id_fkey|foreign key constraint/i.test(deleteError.message);
      setError(linkedToCampaign ? 'Старая связь с кампанией блокирует удаление героя. Повторно выполните migration_interactive_rpg_v1.sql в Supabase и попробуйте ещё раз.' : deleteError.message);
    } else setCharacters(previous => previous.filter(item => item.id !== character.id));
  }

  if (loading) return <Screen><div className="flex items-center gap-3 text-zinc-400"><Loader2 className="animate-spin"/>Загружаем библиотеку героев…</div></Screen>;

  if (view === 'library') return (
    <Screen>
      <div className="w-full max-w-5xl space-y-6">
        <Header onBack={onBack} eyebrow="Библиотека героев" title={title} subtitle="Выберите героя для кампании или создайте нового."/>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button onClick={openCreator} className="min-h-52 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 flex flex-col items-center justify-center gap-3 text-amber-300 transition"><span className="p-3 rounded-full bg-amber-500/10"><Plus/></span><strong>Создать героя</strong><span className="text-xs text-zinc-500">Наследие, путь и предыстория</span></button>
          {characters.map(character => <CharacterCard key={character.id} character={character} onSelect={() => onSelect(character)} onDelete={() => void deleteCharacter(character)}/>) }
        </div>
      </div>
    </Screen>
  );

  return (
    <Screen>
      <div className="w-full max-w-5xl space-y-5">
        <Header onBack={() => stepIndex === 0 ? setView('library') : setStep(STEPS[stepIndex - 1])} eyebrow={`Создание героя · ${stepIndex + 1}/${STEPS.length}`} title={STEP_LABELS[step]} subtitle="Собственная система Chronicles d20"/>
        <div className="flex gap-1">{STEPS.map((item, index) => <div key={item} className={`h-1 flex-1 rounded ${index <= stepIndex ? 'bg-amber-400' : 'bg-zinc-800'}`}/>)}</div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <main className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-7 min-h-[420px]">
          {step === 'identity' && <IdentityStep name={name} setName={setName}/>} 
          {step === 'lineage' && <OptionGrid items={LINEAGES} selectedId={lineageId} onSelect={setLineageId}/>} 
          {step === 'class' && <OptionGrid items={CLASSES} selectedId={classId} onSelect={id => { setClassId(id); setSkills([]); }}/>} 
          {step === 'origin' && <OptionGrid items={ORIGINS} selectedId={originId} onSelect={setOriginId}/>} 
          {step === 'attributes' && <AttributesStep scores={scores} finalScores={finalScores} bonuses={lineage.attributeBonuses} spent={spent} onChange={changeScore}/>} 
          {step === 'skills' && <SkillsStep choices={classDefinition.skillChoices} originSkills={origin.skills} available={availableSkills} selected={skills} onToggle={skill => setSkills(previous => previous.includes(skill) ? previous.filter(item => item !== skill) : previous.length < classDefinition.skillChoices ? [...previous, skill] : previous)}/>} 
          {step === 'story' && <StoryStep answers={answers} setAnswers={setAnswers} variants={variants} selected={backstory} setSelected={setBackstory} generating={generatingStory} onGenerate={() => void generateStories()}/>} 
          {step === 'review' && <ReviewStep name={name} lineageId={lineageId} classId={classId} originId={originId} scores={finalScores} skills={[...origin.skills, ...skills]} backstory={backstory}/>} 
        </main>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-between">
          <button onClick={() => stepIndex === 0 ? setView('library') : setStep(STEPS[stepIndex - 1])} className="min-h-11 px-3 sm:px-4 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-900 flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4"/>Назад</button>
          {step !== 'review' ? <button onClick={nextStep} className="min-h-11 px-3 sm:px-5 py-3 rounded-xl bg-amber-500 text-zinc-950 text-sm sm:text-base font-bold flex items-center justify-center gap-2 hover:bg-amber-400">Продолжить<ArrowRight className="w-4 h-4"/></button> : <button disabled={saving} onClick={() => void saveCharacter()} className="min-h-11 px-3 sm:px-5 py-3 rounded-xl bg-emerald-500 text-zinc-950 text-sm sm:text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}Создать и выбрать</button>}
        </div>
      </div>
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) { return <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 sm:p-8 flex justify-center items-start">{children}</div>; }
function Header({ onBack, eyebrow, title, subtitle }: { onBack: () => void; eyebrow: string; title: string; subtitle: string }) { return <div className="flex items-start gap-3 sm:gap-4"><button onClick={onBack} className="shrink-0 p-3 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800"><ArrowLeft className="w-5 h-5"/></button><div className="min-w-0"><p className="text-[10px] sm:text-xs uppercase tracking-[0.16em] sm:tracking-[0.22em] text-amber-500">{eyebrow}</p><h1 className="text-2xl sm:text-3xl font-black text-white break-words">{title}</h1><p className="text-sm text-zinc-500 mt-1">{subtitle}</p></div></div>; }
function ErrorBox({ children }: { children: ReactNode }) { return <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-300">{children}</div>; }

function CharacterCard({ character, onSelect, onDelete }: { character: Character; onSelect: () => void; onDelete: () => void }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 flex flex-col min-h-52"><div className="flex justify-between"><div className="w-11 h-11 rounded-xl bg-zinc-800 flex items-center justify-center text-xl">{getClassDefinition(character.rules_data?.classId || '').icon}</div><button onClick={onDelete} className="p-2 text-zinc-600 hover:text-red-400"><Trash2 className="w-4 h-4"/></button></div><h2 className="text-lg font-bold mt-4">{character.name}</h2><p className="text-sm text-zinc-400">{character.race} · {character.class}</p><p className="text-xs text-zinc-600 mt-1">Уровень {character.level} · {character.hp_current}/{character.hp_max} HP</p><button onClick={onSelect} className="mt-auto pt-4 text-left text-sm font-bold text-amber-400 hover:text-amber-300">Выбрать героя →</button></div>;
}

function IdentityStep({ name, setName }: { name: string; setName: (value: string) => void }) { return <div className="max-w-xl mx-auto py-12 space-y-5 text-center"><div className="text-5xl">✦</div><div><h2 className="text-2xl font-bold">Как зовут вашего героя?</h2><p className="text-zinc-500 text-sm mt-2">Имя станет частью личных сюжетных линий.</p></div><input autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={50} placeholder="Введите имя" className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-5 py-4 text-center text-xl font-bold outline-none focus:border-amber-500"/></div>; }

function OptionGrid({ items, selectedId, onSelect }: { items: Array<{ id: string; name: string; icon: string; summary: string; traits?: Array<{ name: string; description: string }> }>; selectedId: string; onSelect: (id: string) => void }) {
  return <div className="grid sm:grid-cols-2 gap-3">{items.map(item => <button key={item.id} onClick={() => onSelect(item.id)} className={`text-left rounded-2xl border p-4 transition ${selectedId === item.id ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'}`}><div className="flex gap-3"><span className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-xl shrink-0">{item.icon}</span><div><h3 className="font-bold text-white">{item.name}</h3><p className="text-xs text-zinc-500 mt-1 leading-relaxed">{item.summary}</p>{item.traits?.[0] && <p className="text-xs text-amber-300/80 mt-2"><b>{item.traits[0].name}:</b> {item.traits[0].description}</p>}</div></div></button>)}</div>;
}

function AttributesStep({ scores, finalScores, bonuses, spent, onChange }: { scores: AttributeScores; finalScores: AttributeScores; bonuses: Partial<Record<AttributeKey, number>>; spent: number; onChange: (key: AttributeKey, delta: number) => void }) {
  return <div className="space-y-5"><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><div><h2 className="text-xl font-bold">Распределите потенциал</h2><p className="text-sm text-zinc-500">Значения до бонусов наследия: от 8 до 15.</p></div><span className="font-mono text-amber-400">Осталось {POINT_BUY_BUDGET - spent}</span></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{(Object.keys(scores) as AttributeKey[]).map(key => <div key={key} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><div className="flex justify-between"><span className="font-bold">{ATTRIBUTE_LABELS[key]}</span>{bonuses[key] ? <span className="text-xs text-emerald-400">+{bonuses[key]} наследие</span> : null}</div><div className="flex items-center justify-between mt-4"><button onClick={() => onChange(key, -1)} className="w-11 h-11 rounded-xl bg-zinc-800 text-lg">−</button><div className="text-center"><strong className="text-2xl">{finalScores[key]}</strong><p className="text-[10px] text-zinc-600">база {scores[key]}</p></div><button onClick={() => onChange(key, 1)} className="w-11 h-11 rounded-xl bg-zinc-800 text-lg">+</button></div></div>)}</div></div>;
}

function SkillsStep({ choices, originSkills, available, selected, onToggle }: { choices: number; originSkills: string[]; available: string[]; selected: string[]; onToggle: (skill: string) => void }) {
  return <div className="space-y-5"><div><h2 className="text-xl font-bold">Навыки героя</h2><p className="text-sm text-zinc-500">Выберите {choices}. Происхождение уже даёт: <span className="text-emerald-400">{originSkills.join(', ')}</span>.</p></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{available.map(skill => <button key={skill} onClick={() => onToggle(skill)} className={`p-3 rounded-xl border text-sm ${selected.includes(skill) ? 'border-amber-400 bg-amber-500/10 text-amber-200' : 'border-zinc-800 bg-zinc-950 text-zinc-400'}`}>{selected.includes(skill) ? '✓ ' : ''}{skill}</button>)}</div><p className="text-sm text-zinc-500">Выбрано: {selected.length}/{choices}</p></div>;
}

function StoryStep({ answers, setAnswers, variants, selected, setSelected, generating, onGenerate }: { answers: BackstoryAnswers; setAnswers: Dispatch<SetStateAction<BackstoryAnswers>>; variants: BackstoryData[]; selected: BackstoryData; setSelected: (value: BackstoryData) => void; generating: boolean; onGenerate: () => void }) {
  const fields: Array<[keyof BackstoryAnswers, string, string]> = [['homeland','Откуда герой?','Пограничный город, кочевой клан…'],['goal','Чего он хочет?','Найти человека, вернуть имя…'],['loss','Что он потерял?','Дом, семью, доверие…'],['connection','Кто связывает его с прошлым?','Наставник, соперник, сестра…'],['fear','Чего он боится?','Оказаться беспомощным…'],['secret','Какую тайну скрывает?','Его вина, договор, ложь…']];
  return <div className="space-y-5"><div><h2 className="text-xl font-bold">Предыстория</h2><p className="text-sm text-zinc-500">Ответьте на несколько вопросов или напишите историю самостоятельно.</p></div><div className="grid sm:grid-cols-2 gap-3">{fields.map(([key,label,placeholder]) => <label key={key} className="text-xs text-zinc-400">{label}<input value={String(answers[key])} onChange={event => setAnswers(previous => ({ ...previous, [key]: event.target.value }))} placeholder={placeholder} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500"/></label>)}</div><button disabled={generating} onClick={onGenerate} className="px-4 py-3 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 font-bold flex items-center gap-2 disabled:opacity-50">{generating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}Предложить три истории</button>{variants.length > 0 && <div className="grid sm:grid-cols-3 gap-2">{variants.map((variant,index) => <button key={index} onClick={() => setSelected(variant)} className={`text-left p-3 rounded-xl border text-xs ${selected === variant ? 'border-violet-400 bg-violet-500/10' : 'border-zinc-800'}`}><b>Вариант {index + 1}</b><p className="text-zinc-500 mt-1 line-clamp-4">{variant.prose}</p></button>)}</div>}<label className="block text-xs text-zinc-400">Итоговая история<textarea value={selected.prose} onChange={event => setSelected({ ...selected, ...answers, prose: event.target.value })} rows={8} placeholder="Напишите предысторию или выберите предложенный вариант…" className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500 resize-y"/></label></div>;
}

function ReviewStep({ name, lineageId, classId, originId, scores, skills, backstory }: { name: string; lineageId: string; classId: string; originId: string; scores: AttributeScores; skills: string[]; backstory: BackstoryData }) {
  const lineage = getLineage(lineageId), path = getClassDefinition(classId), origin = getOrigin(originId);
  return <div className="space-y-5"><div className="flex items-center gap-4"><div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-3xl">{path.icon}</div><div><h2 className="text-2xl font-black">{name}</h2><p className="text-zinc-400">{lineage.name} · {path.name} · {origin.name}</p></div></div><div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{(Object.keys(scores) as AttributeKey[]).map(key => <div key={key} className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-center"><p className="text-[9px] text-zinc-600 uppercase">{ATTRIBUTE_LABELS[key]}</p><b>{scores[key]}</b></div>)}</div><div><h3 className="text-sm font-bold text-amber-300">Навыки</h3><p className="text-sm text-zinc-400 mt-1">{skills.join(', ')}</p></div><div><h3 className="text-sm font-bold text-amber-300">Предыстория</h3><p className="text-sm text-zinc-400 mt-1 whitespace-pre-line leading-relaxed">{backstory.prose}</p></div></div>;
}
