import {
  ArrowRight,
  BookOpen,
  BookOpenText,
  Crown,
  Map,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import { CampaignRuntime } from '../game/types';

interface HomeScreenProps {
  campaigns: CampaignRuntime[];
  onSolo: () => void;
  onParty: () => void;
  onJoin: () => void;
  onLibrary: () => void;
  onContinue: (campaign: CampaignRuntime) => void;
  error: string;
}

const actions = [
  {
    id: '01',
    eyebrow: 'Начать хронику',
    title: 'Новая соло-игра',
    subtitle: 'Ваш герой, личная история и решения без ожидания партии.',
    icon: BookOpen,
    action: 'solo' as const,
    primary: true,
  },
  {
    id: '02',
    eyebrow: 'Собрать отряд',
    title: 'Создать партию',
    subtitle: 'Общая кампания, код приглашения и голосование за выбор.',
    icon: Users,
    action: 'party' as const,
  },
  {
    id: '03',
    eyebrow: 'Вернуться к своим',
    title: 'Войти по коду',
    subtitle: 'Присоединиться к уже созданному приключению.',
    icon: Swords,
    action: 'join' as const,
  },
  {
    id: '04',
    eyebrow: 'Зал героев',
    title: 'Персонажи',
    subtitle: 'Создать нового героя или привести в порядок старого.',
    icon: ScrollText,
    action: 'library' as const,
  },
];

export default function HomeScreen({ campaigns, onSolo, onParty, onJoin, onLibrary, onContinue, error }: HomeScreenProps) {
  const handlers = { solo: onSolo, party: onParty, join: onJoin, library: onLibrary };

  return (
    <main className="home-shell min-h-screen text-zinc-100">
      <HomeAtmosphere />

      <div className="home-content mx-auto max-w-[1380px] px-4 pb-16 sm:px-7 lg:px-10">
        <nav className="home-nav" aria-label="Главная навигация">
          <div className="home-brand">
            <span className="home-brand-mark" aria-hidden="true"><Crown size={19} /></span>
            <span><strong>Chronicles</strong><small>Живая ролевая хроника</small></span>
          </div>
          <div className="home-memory"><i /><span>Мир помнит решения</span><ShieldCheck size={15} /></div>
        </nav>

        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="home-kicker"><span>✦</span> Твоя история уже ждёт</p>
            <h1>Не просто читай.<br /><em>Оставь след</em> в мире.</h1>
            <p className="home-lead">Текстовая RPG как настоящая книга: цельная история, живые персонажи, последствия каждого решения и мир, который ничего не забывает.</p>
            <button className="home-cta" onClick={onSolo}>
              <span><small>Открыть новую главу</small>Начать приключение</span>
              <span className="home-cta-arrow"><ArrowRight size={22} /></span>
            </button>
            <div className="home-pill-row" aria-label="Возможности игры">
              <span><BookOpenText size={14} /> Соло и кооператив</span>
              <span><Map size={14} /> Живой мир</span>
              <span><Sparkles size={14} /> Личные сюжетные линии</span>
            </div>
          </div>

          <div className="home-sigil-wrap" aria-hidden="true">
            <div className="home-sigil-glow" />
            <div className="home-sigil-orbit home-sigil-orbit-outer"><i>◆</i><i>✦</i><i>◇</i><i>✧</i></div>
            <div className="home-sigil-orbit home-sigil-orbit-inner" />
            <div className="home-book">
              <div className="home-book-page home-book-page-left"><span>Хроника</span><b>выбора</b><i /></div>
              <div className="home-book-spine" />
              <div className="home-book-page home-book-page-right"><span>Мир</span><b>помнит</b><i /></div>
            </div>
            <div className="home-sigil-caption"><span>Судьба не написана</span><b>пока ты не выбрал</b></div>
          </div>
        </section>

        {error && <div className="home-error" role="alert">{error}</div>}

        <section className="home-section" aria-labelledby="paths-title">
          <div className="home-section-heading">
            <div><p>Выбери путь</p><h2 id="paths-title">Как начнётся эта история?</h2></div>
            <span>Каждый путь можно продолжить с любого устройства</span>
          </div>
          <div className="home-actions">
            {actions.map(({ id, eyebrow, title, subtitle, icon: Icon, action, primary }) => (
              <button key={action} onClick={handlers[action]} className={`home-action ${primary ? 'home-action-primary' : ''}`}>
                <span className="home-action-number">{id}</span>
                <span className="home-action-icon"><Icon size={23} /></span>
                <span className="home-action-copy"><small>{eyebrow}</small><strong>{title}</strong><span>{subtitle}</span></span>
                <span className="home-action-arrow"><ArrowRight size={18} /></span>
              </button>
            ))}
          </div>
        </section>

        <section className="home-section home-library" aria-labelledby="campaigns-title">
          <div className="home-section-heading">
            <div><p>Твои хроники</p><h2 id="campaigns-title">Продолжить приключение</h2></div>
            {campaigns.length > 0 && <span>{campaigns.length} {campaigns.length === 1 ? 'активная история' : 'активных историй'}</span>}
          </div>

          {campaigns.length ? (
            <div className="home-campaign-grid">
              {campaigns.map(campaign => <CampaignCard key={campaign.id} campaign={campaign} onContinue={onContinue} />)}
            </div>
          ) : (
            <div className="home-empty">
              <div className="home-empty-mark"><BookOpenText size={28} /></div>
              <div><strong>Первая страница пока пуста</strong><p>Создай героя и начни приключение — здесь появится твоя хроника с сохранённым прогрессом.</p></div>
              <button onClick={onSolo}>Написать первую главу <ArrowRight size={17} /></button>
            </div>
          )}
        </section>

        <footer className="home-footer"><span>Chronicles</span><i /><p>Истории, которые помнят</p></footer>
      </div>
    </main>
  );
}

function CampaignCard({ campaign, onContinue }: { campaign: CampaignRuntime; onContinue: (campaign: CampaignRuntime) => void }) {
  const actIndex = Math.max(0, campaign.bible.acts.findIndex(act => act.id === campaign.state.currentActId));
  const totalScenes = Math.max(campaign.bible.scenePlan?.length || campaign.bible.acts.length * 4, campaign.state.sceneNumber);
  const progress = Math.max(4, Math.min(100, Math.round((campaign.state.sceneNumber / totalScenes) * 100)));
  const summary = campaign.currentScene.recap || campaign.bible.tagline;

  return (
    <button onClick={() => onContinue(campaign)} className="home-campaign-card">
      <span className="home-campaign-topline">
        <span className={`home-mode-badge ${campaign.mode === 'party' ? 'home-mode-party' : ''}`}>{campaign.mode === 'solo' ? 'Соло' : 'Партия'}</span>
        <span>Акт {actIndex + 1} · сцена {campaign.state.sceneNumber}</span>
      </span>
      <span className="home-campaign-body">
        <small>{campaign.currentScene.location || campaign.bible.setting}</small>
        <strong>{campaign.bible.title}</strong>
        <span>{summary}</span>
      </span>
      <span className="home-campaign-progress"><i style={{ width: `${progress}%` }} /></span>
      <span className="home-campaign-footer"><span>{progress}% хроники</span><b>Продолжить <ArrowRight size={16} /></b></span>
    </button>
  );
}

export function HomeAtmosphere() {
  return (
    <div className="home-atmosphere" aria-hidden="true">
      <div className="home-aurora" />
      <div className="home-grid" />
      <div className="home-runes"><span>ᚱ</span><span>ᚲ</span><span>ᛟ</span><span>ᚦ</span><span>ᛇ</span><span>ᛃ</span></div>
      <div className="home-grain" />
      <div className="home-vignette" />
    </div>
  );
}
