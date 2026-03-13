# 🎮 Гайд по интеграции системы лобби

## 📋 Что было создано

### 1. База данных
- **supabase-lobby-schema.sql** - SQL схема для лобби системы
  - Таблица `characters` - глобальные персонажи
  - Таблица `lobbies` - лобби (комнаты ожидания)
  - Таблица `lobby_participants` - связь персонажей и лобби
  - 4 тестовых персонажа

### 2. Компоненты
- **CharacterSelect.tsx** - Выбор/создание персонажа
- **LobbyRoom.tsx** - Комната ожидания с участниками

### 3. Типы
- Обновлен `types.ts` с новыми интерфейсами

## 🚀 Шаги интеграции

### Шаг 1: Обнови базу данных

```bash
# 1. Открой Supabase SQL Editor
# 2. Скопируй содержимое supabase-lobby-schema.sql
# 3. Выполни SQL
```

### Шаг 2: Обнови App.tsx

Добавь импорты в начало файла:

```typescript
import CharacterSelect from './components/CharacterSelect';
import LobbyRoom from './components/LobbyRoom';
import { Lobby, Character } from './types';
```

Добавь новые состояния после существующих:

```typescript
// Добавь после const [showInstallPrompt, setShowInstallPrompt] = useState(false);

// Lobby system states
const [currentScreen, setCurrentScreen] = useState<'menu' | 'character-select' | 'lobby' | 'game'>('menu');
const [currentLobby, setCurrentLobby] = useState<Lobby | null>(null);
const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
const [userSessionId] = useState(() => {
  // Генерируем уникальный ID сессии
  const stored = localStorage.getItem('user_session_id');
  if (stored) return stored;
  const newId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  localStorage.setItem('user_session_id', newId);
  return newId;
});
```

Замени функцию `createRoom`:

```typescript
const createRoom = async () => {
  if (!userName.trim()) {
    setError('Пожалуйста, введите имя вашего персонажа.');
    return;
  }
  
  setIsJoining(true);
  setError(null);

  const newLobbyId = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  try {
    // Создаем лобби
    const { error: lobbyError } = await supabase.from('lobbies').insert({
      id: newLobbyId,
      name: `Приключение ${newLobbyId}`,
      created_by: userName,
      max_players: 4,
      is_active: true,
    });

    if (lobbyError) throw lobbyError;

    // Получаем созданное лобби
    const { data: lobby, error: fetchError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', newLobbyId)
      .single();

    if (fetchError) throw fetchError;

    setCurrentLobby(lobby);
    setCurrentScreen('character-select');
  } catch (err: any) {
    setError(`Ошибка создания лобби: ${err.message}`);
    console.error(err);
  } finally {
    setIsJoining(false);
  }
};
```

Замени функцию `joinRoom`:

```typescript
const joinRoom = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!userName.trim()) {
    setError('Пожалуйста, введите имя вашего персонажа.');
    return;
  }
  if (!roomInput.trim()) {
    setError('Пожалуйста, введите код лобби.');
    return;
  }

  setIsJoining(true);
  setError(null);

  try {
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', roomInput.toUpperCase())
      .eq('is_active', true)
      .single();

    if (lobbyError || !lobby) {
      setError('Лобби не найдено или уже началась игра.');
      setIsJoining(false);
      return;
    }

    // Проверяем, не заполнено ли лобби
    const { data: participants } = await supabase
      .from('lobby_participants')
      .select('id')
      .eq('lobby_id', lobby.id);

    if (participants && participants.length >= lobby.max_players) {
      setError('Лобби заполнено.');
      setIsJoining(false);
      return;
    }

    setCurrentLobby(lobby);
    setCurrentScreen('character-select');
  } catch (err: any) {
    setError(`Ошибка входа в лобби: ${err.message}`);
    console.error(err);
  } finally {
    setIsJoining(false);
  }
};
```

Добавь обработчики для лобби:

```typescript
const handleCharacterSelected = (character: Character) => {
  setSelectedCharacter(character);
  setUserName(character.name); // Устанавливаем имя персонажа
  setCurrentScreen('lobby');
};

const handleStartGame = async () => {
  if (!currentLobby || !selectedCharacter) return;

  // Создаем комнату для игры
  const newRoomId = currentLobby.id;
  
  try {
    const { error: roomError } = await supabase.from('rooms').insert({
      id: newRoomId,
      created_by: selectedCharacter.name,
      lobby_id: currentLobby.id,
    });

    if (roomError) throw roomError;

    saveRoomToRecent(newRoomId);
    setRoomId(newRoomId);
    setCurrentScreen('game');
  } catch (err: any) {
    setError(`Ошибка создания комнаты: ${err.message}`);
    console.error(err);
  }
};

const handleLeaveLobby = () => {
  setCurrentLobby(null);
  setSelectedCharacter(null);
  setCurrentScreen('menu');
};
```

Замени условие рендеринга в конце:

```typescript
// Замени:
// if (roomId) {
//   return <Chat roomId={roomId} userName={userName} onLeave={() => setRoomId(null)} theme={theme} setTheme={handleThemeChange} />;
// }

// На:
if (currentScreen === 'game' && roomId) {
  return <Chat roomId={roomId} userName={userName} onLeave={() => {
    setRoomId(null);
    setCurrentScreen('menu');
    setCurrentLobby(null);
    setSelectedCharacter(null);
  }} theme={theme} setTheme={handleThemeChange} />;
}

if (currentScreen === 'character-select' && currentLobby) {
  return (
    <CharacterSelect
      lobbyId={currentLobby.id}
      userSessionId={userSessionId}
      onCharacterSelected={handleCharacterSelected}
      onBack={handleLeaveLobby}
    />
  );
}

if (currentScreen === 'lobby' && currentLobby && selectedCharacter) {
  return (
    <LobbyRoom
      lobby={currentLobby}
      character={selectedCharacter}
      userSessionId={userSessionId}
      onStartGame={handleStartGame}
      onLeave={handleLeaveLobby}
    />
  );
}
```

### Шаг 3: Обнови текст в UI (опционально)

В главном меню замени:
- "Новая игра" → "Создать лобби"
- "Код комнаты" → "Код лобби"

## 🎮 Как это работает

### Поток пользователя:

```
1. Главное меню
   ↓
2. Создать лобби / Войти в лобби
   ↓
3. Выбор персонажа
   - Выбрать существующего
   - Создать нового
   ↓
4. Комната ожидания (лобби)
   - Видны все участники
   - Кнопка "Готов"
   - Хост может начать игру
   ↓
5. Игра (Chat)
   - Все персонажи в одной комнате
   - AI знает всех персонажей
```

### Блокировка персонажей:

- Когда игрок выбирает персонажа, создается запись в `lobby_participants`
- Constraint `UNIQUE(lobby_id, character_id)` не позволяет выбрать занятого персонажа
- При выходе из лобби запись удаляется
- Heartbeat каждые 30 секунд обновляет `joined_at`
- Функция `cleanup_inactive_participants()` освобождает персонажей через 5 минут неактивности

## 🧪 Тестирование

### 1. Создай лобби
```
1. Введи имя
2. Нажми "Создать лобби"
3. Выбери персонажа (или создай нового)
4. Попадешь в комнату ожидания
```

### 2. Присоединись к лобби (в другой вкладке)
```
1. Введи имя
2. Введи код лобби
3. Нажми "Войти"
4. Выбери ДРУГОГО персонажа
5. Попадешь в ту же комнату
```

### 3. Начни игру
```
1. Оба игрока нажимают "Готов"
2. Хост нажимает "Начать игру"
3. Все переходят в чат
```

## 🐛 Troubleshooting

### Персонаж не освобождается
```sql
-- Вручную очисти участников
DELETE FROM lobby_participants WHERE lobby_id = 'YOUR_LOBBY_ID';
```

### Лобби не создается
```sql
-- Проверь таблицы
SELECT * FROM lobbies;
SELECT * FROM characters;
SELECT * FROM lobby_participants;
```

### Ошибка "таблица не найдена"
```
Выполни supabase-lobby-schema.sql в Supabase SQL Editor
```

## 📊 Структура БД

```
characters (глобальные персонажи)
  ├─ id (UUID)
  ├─ name (UNIQUE)
  ├─ race, class, level
  ├─ hp_current, hp_max
  └─ stats (str, dex, con, int, wis, cha)

lobbies (комнаты ожидания)
  ├─ id (TEXT)
  ├─ name
  ├─ max_players
  ├─ is_active
  └─ created_by

lobby_participants (кто в каком лобби)
  ├─ id (UUID)
  ├─ lobby_id → lobbies(id)
  ├─ character_id → characters(id)
  ├─ user_session_id
  └─ is_ready
  └─ UNIQUE(lobby_id, character_id) ← Блокировка

rooms (игровые комнаты)
  ├─ id (TEXT)
  ├─ lobby_id → lobbies(id)
  └─ character_stats (JSONB)
```

## 🎯 Следующие улучшения

- [ ] Аватары персонажей
- [ ] Редактирование персонажей
- [ ] Удаление персонажей
- [ ] Настройки лобби (приватность, макс. игроков)
- [ ] Чат в лобби
- [ ] Kick игроков (для хоста)
- [ ] Передача хоста
- [ ] История игр персонажа

---

**Готово!** Система лобби с персонажами работает! 🎉
