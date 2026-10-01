import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './services/AuthContext.tsx';
import { SettingsProvider } from './services/SettingsContext.tsx';
import { NotificationProvider } from './services/NotificationContext.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <SettingsProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </SettingsProvider>
    </AuthProvider>
  </React.StrictMode>
);
