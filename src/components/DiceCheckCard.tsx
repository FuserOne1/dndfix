import { Dices, Sparkles } from 'lucide-react';
import type { ChoiceResolution } from '../game/types';

export default function DiceCheckCard({ resolution }: { resolution: ChoiceResolution }) {
  if (resolution.roll === undefined) return null;
  const parts = [
    { label: 'd20', value: resolution.roll },
    { label: resolution.attribute ? attributeShort(resolution.attribute) : 'характеристика', value: resolution.attributeModifier || 0 },
    ...(resolution.proficiencyBonus ? [{ label: resolution.skill || 'мастерство', value: resolution.proficiencyBonus }] : []),
    ...(resolution.itemBonus ? [{ label: resolution.itemBonusLabel || 'предмет', value: resolution.itemBonus }] : []),
  ];

  return <section className={`dice-result ${resolution.success ? 'dice-result-success' : 'dice-result-failure'}`}>
    <div className="dice-result-heading">
      <div className="dice-result-icon"><Dices/></div>
      <div><p className="dice-result-kicker">Проверка: {resolution.skill || attributeName(resolution.attribute)}</p><strong>{resolution.success ? 'Успех' : 'Неудача'}</strong></div>
      <div className="dice-result-total">{resolution.total}<span>/ {resolution.difficulty}</span></div>
    </div>
    {resolution.rolls && resolution.rolls.length > 1 && <div className="dice-advantage"><Sparkles/>Преимущество: {resolution.advantageReason} · броски {resolution.rolls.join(' и ')}</div>}
    <div className="dice-formula" aria-label="Формула результата броска">
      {parts.map((part, index) => <div key={`${part.label}-${index}`} className="dice-formula-part">
        {index > 0 && <span className="dice-formula-operator">{part.value < 0 ? '−' : '+'}</span>}
        <span className="dice-formula-term"><span className="dice-formula-value">{index === 0 ? part.value : Math.abs(part.value)}</span><span className="dice-formula-label">{part.label}</span></span>
      </div>)}
      <span className="dice-formula-equals">= {resolution.total}</span>
    </div>
    <p className="dice-result-footnote">Шанс до броска: {resolution.successChance}% · сложность {resolution.difficulty}</p>
  </section>;
}

function attributeShort(attribute?: string) {
  return ({ strength: 'СИЛ', dexterity: 'ЛОВ', constitution: 'СТО', intelligence: 'РАЗ', wisdom: 'ВОС', charisma: 'ВЛИ' } as Record<string, string>)[attribute || ''] || 'хар.';
}

function attributeName(attribute?: string) {
  return ({ strength: 'силы', dexterity: 'ловкости', constitution: 'стойкости', intelligence: 'разума', wisdom: 'восприятия', charisma: 'влияния' } as Record<string, string>)[attribute || ''] || 'характеристики';
}
