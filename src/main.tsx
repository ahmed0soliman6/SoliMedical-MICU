import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SettingsProvider } from './services/SettingsContext.tsx';
import { AuthProvider } from './services/AuthContext.tsx';
import { NotificationProvider } from './services/NotificationContext.tsx';
import { initGlobalArabicNumeralConverter } from './services/numberUtils.ts';

// Initialize global auto-conversion of Arabic digits to English digits
initGlobalArabicNumeralConverter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </SettingsProvider>
  </StrictMode>,
);


