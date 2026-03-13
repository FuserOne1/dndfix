# ⚡ Быстрый старт - Система лобби

## 1️⃣ Обнови базу данных (2 минуты)

```bash
# Открой Supabase SQL Editor
# Скопируй и выполни supabase-lobby-schema.sql
```

## 2️⃣ Добавь в App.tsx (5 минут)

### Импорты (в начало файла)
```typescript
import CharacterSelect from './components/CharacterSelect';
import LobbyRoom from './components/LobbyRoom';
import { Lobby, Character } from './types';
```

### Состояния (после существующих useState)
```typescript
const [currentScreen, setCurrentScreen] = useState<'menu' | 'character-select' | 'lobby' | 'game'>('menu');
const [currentLobby, setCurrentLobby] = useState<Lobby | null>(null);
const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
const [userSessionId] = useState(() => {
  const stored = localStorage.getItem('user_session_id');
  if (stored) return stored;
  const newId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  localStorage.setItem('user_session_id', newId);
  return newId;
});
```

### Обработчики (добавь новые функции)
```typescript
const handleCharacterSelected = (character: Character) => {
  setSelectedCharacter(character);
  setUserName(character.name);
  setCurrentScreen('lobby');
};

const handleStartGame = async () => {
  if (!currentLobby || !selectedCharacter) return;
  const newRoomId = currentLobby.id;
  
  try {
    await supabase.from('rooms').insert({
      id: newRoomId,
      created_by: selectedCharacter.name,
      lobby_id: currentLobby.id,
    });
    saveRoomToRecent(newRoomId);
    setRoomId(newRoomId);
    setCurrentScreen('game');
  } catch (err: any) {
    setError(`Ошибка: ${err.message}`);
  }
};

const handleLeaveLobby = () => {
  setCurrentLobby(null);
  setSelectedCharacter(null);
  setCurrentScreen('menu');
};
```

### Обнови createRoom
```typescript
const createRoom = async () => {
  if (!userName.trim()) {
    setError('Введите имя.');
    return;
  }
  
  setIsJoining(true);
  const newLobbyId = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  try {
    await supabase.from('lobbies').insert({
      id: newLobbyId,
      name: `Приключение ${newLobbyId}`,
      created_by: userName,
      max_players: 4,
      is_active: true,
    });

    const { data: lobby } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', newLobbyId)
      .single();

    setCurrentLobby(lobby);
    setCurrentScreen('character-select');
  } catch (err: any) {
    setError(err.message);
  } finally {
    setIsJoining(false);
  }
};
```

### Обнови joinRoom
```typescript
const joinRoom = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!userName.trim() || !roomInput.trim()) {
    setError('Заполните все поля.');
    return;
  }

  setIsJoining(true);
  
  try {
    const { data: lobby } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', roomInput.toUpperCase())
      .eq('is_active', true)
      .single();

    if (!lobby) {
      setError('Лобби не найдено.');
      setIsJoining(false);
      return;
    }

    setCurrentLobby(lobby);
    setCurrentScreen('character-select');
  } catch (err: any) {
    setError(err.message);
  } finally {
    setIsJoining(false);
  }
};
```

### Обнови рендеринг (в конце компонента)
```typescript
// ЗАМЕНИ:
// if (roomId) {
//   return <Chat ... />;
// }

// НА:
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

// Дальше идет обычный return с главным меню
```

## 3️⃣ Тестируй (2 минуты)

```bash
npm run dev
```

1. Создай лобби
2. Выбери персонажа
3. Нажми "Готов"
4. Нажми "Начать игру"

## ✅ Готово!

Теперь у тебя:
- ✅ Выбор персонажей
- ✅ Создание персонажей
- ✅ Блокировка занятых персонажей
- ✅ Комната ожидания
- ✅ Система готовности
- ✅ Автоматическое освобождение через 5 минут

---

**Полная документация:** [LOBBY_INTEGRATION_GUIDE.md](LOBBY_INTEGRATION_GUIDE.md)
