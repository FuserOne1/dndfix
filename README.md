<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🎮 D&D Dark Fantasy RPG - AI-Powered Dungeon Master

Multiplayer text-based RPG with AI Dungeon Master powered by Claude/GPT-4 and optimized token management.

## ✨ Features

- 🤖 **AI Dungeon Master** - Claude 3.5 Sonnet / GPT-4 для креативных ответов
- 💰 **Оптимизация токенов** - Экономия ~57% через суммаризацию (Gemini Flash)
- 👥 **Multiplayer** - Играйте вместе с друзьями в реальном времени
- 🎭 **Система лобби** - Выбор/создание персонажей перед игрой
- 🔒 **Блокировка персонажей** - Один персонаж = один игрок
- 📊 **Character Sheets** - Полная система характеристик D&D 5e
- 🎲 **Smart Dice Rolls** - Автоматическое определение типа броска
- 🎨 **4 темы оформления** - Emerald, Crimson, Amethyst, Amber
- 💾 **Persistent Storage** - Supabase для хранения истории и персонажей

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- OpenRouter API key ([получить](https://openrouter.ai/keys))
- Google Gemini API key ([получить](https://ai.google.dev/))
- Supabase account ([создать](https://supabase.com/))

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd <your-repo-name>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your keys:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_OPENROUTER_API_KEY=sk-or-v1-xxxxx
   VITE_GEMINI_API_KEY=AIzaSyxxxxx
   ```

4. Run the app:
   ```bash
   npm run dev
   ```

5. Open http://localhost:5173

## 📚 Documentation

**→ [📖 Полная документация](DOCS_INDEX.md)** - Индекс всех документов

### AI Orchestrator:
- **[⚡ Quick Start](QUICKSTART.md)** - 5 минут до запуска
- **[AI Setup Guide](AI_SETUP.md)** - Полная инструкция по настройке AI
- **[Migration Guide](MIGRATION.md)** - Переход с Groq на OpenRouter
- **[Configurations](CONFIGURATIONS.md)** - Готовые конфигурации
- **[FAQ](FAQ.md)** - Часто задаваемые вопросы
- **[Test Interface](test-ai.html)** - Веб-интерфейс для тестирования

### Система лобби:
- **[⚡ Lobby Quick Start](LOBBY_QUICKSTART.md)** - Быстрая интеграция
- **[Lobby Integration Guide](LOBBY_INTEGRATION_GUIDE.md)** - Полная инструкция

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│ User Message                                     │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ AI Orchestrator                                  │
│ • Checks if summarization needed (>15 msgs)     │
│ • Gemini Flash summarizes old messages          │
│ • Takes last 10 messages                         │
│ • Builds optimized context                       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ OpenRouter → Claude 3.5 Sonnet / GPT-4          │
│ Generates DM response                            │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ Response sent to player                          │
└─────────────────────────────────────────────────┘
```

## 💰 Cost Optimization

| Messages | Without Optimization | With Optimization | Savings |
|----------|---------------------|-------------------|---------|
| 10       | $0.008              | $0.006            | 25%     |
| 30       | $0.023              | $0.012            | 48%     |
| 50       | $0.038              | $0.016            | 57%     |
| 100      | $0.075              | $0.025            | 67%     |

**On 1000 requests (50 messages each):**
- Without optimization: $37.50
- With optimization: $16.00
- **Savings: $21.50 (57%)**

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Motion
- **Backend**: Supabase (PostgreSQL + Realtime)
- **AI**: OpenRouter (Claude/GPT-4), Google Gemini
- **Build**: Vite
- **Deployment**: Vercel / Netlify

## 📁 Project Structure

```
src/
├── components/
│   └── Chat.tsx              # Main chat component
├── lib/
│   ├── ai-orchestrator.ts    # AI request optimization
│   ├── ai-config.ts          # Model configuration
│   ├── ai-integration-example.ts  # Usage examples
│   ├── ai-test.ts            # Testing utilities
│   └── supabase.ts           # Database client
├── types.ts                  # TypeScript types
└── main.tsx                  # App entry point

docs/
├── AI_SETUP.md               # Full setup guide
├── MIGRATION.md              # Migration guide
├── AI_SUMMARY.md             # Quick summary
└── test-ai.html              # Test interface
```

## 🧪 Testing

### Web Interface
Open `test-ai.html` in your browser for interactive testing.

### Console
```javascript
import { runAllTests } from './src/lib/ai-test';

runAllTests(
  'sk-or-v1-xxxxx',  // OpenRouter key
  'AIzaSyxxxxx'      // Gemini key
);
```

## 🎯 Roadmap

- [ ] Streaming responses (real-time generation)
- [ ] Image generation integration (DALL-E/Midjourney)
- [ ] Voice input/output
- [ ] Mobile app (React Native)
- [ ] Campaign management
- [ ] Character marketplace

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- OpenRouter for unified LLM API
- Google Gemini for free summarization
- Supabase for backend infrastructure
- D&D 5e for game mechanics

---

**Need help?** Check out [AI_SETUP.md](AI_SETUP.md) or open an issue!
