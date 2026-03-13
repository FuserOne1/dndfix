import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  // Временно отключаем StrictMode для отладки лобби
  // <StrictMode>
    <App />
  // </StrictMode>,
);
