import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SystemSettings, DEFAULT_SYSTEM_SETTINGS, DEFAULT_NOTIFICATION_SETTINGS, NotificationSettings } from '../types/settings.ts';
import { subscribeToSystemSettings, syncSystemSettingsToCloud, firestore } from './firebase.ts';
import { doc, setDoc } from 'firebase/firestore';
import { IcuUser } from '../types/schema.ts';

export type Language = 'en' | 'ar';
export type ThemeOption = 'light' | 'dark' | 'system';

const SETTINGS_STORAGE_KEY = 'soli_medical_icu_settings_v1';
export const USER_LANG_STORAGE_KEY = 'soli_icu_user_language';
export const USER_THEME_STORAGE_KEY = 'soli_icu_user_theme';

/**
 * Auto-detects device/browser language (e.g. Arabic or English).
 */
export function detectDeviceLanguage(): Language {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'ar';
  const deviceLocales = [
    navigator.language,
    ...(navigator.languages || [])
  ];
  for (const loc of deviceLocales) {
    if (loc && loc.toLowerCase().startsWith('ar')) return 'ar';
    if (loc && loc.toLowerCase().startsWith('en')) return 'en';
  }
  return 'ar';
}

/**
 * Retrieves the user-specific or device-specific preferred language.
 */
export function getLocalUserLanguage(uid?: string): Language {
  if (typeof window === 'undefined') return detectDeviceLanguage();
  try {
    if (uid) {
      const accountLang = localStorage.getItem(`soli_icu_user_lang_${uid}`);
      if (accountLang === 'ar' || accountLang === 'en') return accountLang;
    }

    const activeUserRaw = localStorage.getItem('soli_icu_active_user');
    if (activeUserRaw) {
      const activeUser = JSON.parse(activeUserRaw);
      if (activeUser?.uid) {
        const accountLang = localStorage.getItem(`soli_icu_user_lang_${activeUser.uid}`) || activeUser.preferredLanguage;
        if (accountLang === 'ar' || accountLang === 'en') return accountLang;
      }
    }

    const deviceLang = localStorage.getItem(USER_LANG_STORAGE_KEY);
    if (deviceLang === 'ar' || deviceLang === 'en') return deviceLang;

    // Backward compatibility check
    const legacy = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed?.language === 'ar' || parsed?.language === 'en') return parsed.language;
    }
  } catch (e) {
    console.error('Error reading local user language:', e);
  }
  return detectDeviceLanguage();
}

/**
 * Retrieves saved ThemeOption ('light' | 'dark' | 'system').
 */
export function getLocalUserThemeOption(): ThemeOption {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = localStorage.getItem(USER_THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved as ThemeOption;
  } catch {}
  return 'system'; // Default to Device/System theme
}

/**
 * Evaluates current system device theme ('dark' or 'light').
 */
export function getSystemDeviceTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * Resolves effective theme ('light' or 'dark') based on ThemeOption.
 */
export function getEffectiveTheme(option?: ThemeOption): 'light' | 'dark' {
  const opt = option || getLocalUserThemeOption();
  if (opt === 'system') {
    return getSystemDeviceTheme();
  }
  return opt;
}

export function getLocalUserTheme(): 'light' | 'dark' {
  return getEffectiveTheme();
}

export function loadSavedSettings(): SystemSettings {
  const localLang = getLocalUserLanguage();
  const localTheme = getLocalUserTheme();

  if (typeof window === 'undefined') {
    return {
      ...DEFAULT_SYSTEM_SETTINGS,
      language: localLang,
      theme: localTheme,
    };
  }

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_SYSTEM_SETTINGS,
        language: localLang,
        theme: localTheme,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...parsed,
      // Personal preferences ALWAYS take precedence over shared system settings
      language: localLang,
      theme: localTheme,
      features: {
        ...DEFAULT_SYSTEM_SETTINGS.features,
        ...(parsed.features || {}),
      },
      unit: {
        ...DEFAULT_SYSTEM_SETTINGS.unit,
        ...(parsed.unit || {}),
      },
      notifications: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(parsed.notifications || {}),
        vitalThresholds: {
          ...DEFAULT_NOTIFICATION_SETTINGS.vitalThresholds,
          ...(parsed.notifications?.vitalThresholds || {}),
        },
        events: {
          ...DEFAULT_NOTIFICATION_SETTINGS.events,
          ...(parsed.notifications?.events || {}),
        }
      },
      labCategories: parsed.labCategories || DEFAULT_SYSTEM_SETTINGS.labCategories,
      infusionDrugs: parsed.infusionDrugs || DEFAULT_SYSTEM_SETTINGS.infusionDrugs,
      ventilatorModes: parsed.ventilatorModes || DEFAULT_SYSTEM_SETTINGS.ventilatorModes,
      fluidCategories: parsed.fluidCategories || DEFAULT_SYSTEM_SETTINGS.fluidCategories,
      antibioticsPresets: parsed.antibioticsPresets || DEFAULT_SYSTEM_SETTINGS.antibioticsPresets,
    };
  } catch (e) {
    console.error('Failed to load system settings:', e);
    return {
      ...DEFAULT_SYSTEM_SETTINGS,
      language: localLang,
      theme: localTheme,
    };
  }
}

export function saveSettingsToStorage(settings: SystemSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      ...settings,
      lastUpdated: new Date().toISOString(),
    }));
  } catch (e) {
    console.error('Failed to save system settings:', e);
  }
}

interface SettingsContextType {
  settings: SystemSettings;
  themeOption: ThemeOption;
  setThemeOption: (option: ThemeOption) => void;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  updateNotificationSettings: (newNotifs: Partial<NotificationSettings>) => void;
  toggleFeature: (featureKey: keyof SystemSettings['features']) => void;
  toggleTheme: () => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SystemSettings>(loadSavedSettings);
  const [themeOption, setThemeOptionState] = useState<ThemeOption>(getLocalUserThemeOption);

  // Set Theme Option (light, dark, or system)
  const setThemeOption = (option: ThemeOption) => {
    setThemeOptionState(option);
    try {
      localStorage.setItem(USER_THEME_STORAGE_KEY, option);
    } catch {}

    const effTheme = getEffectiveTheme(option);
    setSettings(prev => {
      const updated = {
        ...prev,
        theme: effTheme,
        lastUpdated: new Date().toISOString(),
      };
      saveSettingsToStorage(updated);
      return updated;
    });
  };

  // Real-time listener for system prefers-color-scheme changes when themeOption === 'system'
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = () => {
      if (themeOption === 'system') {
        const effTheme = mediaQuery.matches ? 'dark' : 'light';
        setSettings(prev => {
          if (prev.theme === effTheme) return prev;
          const updated = { ...prev, theme: effTheme };
          saveSettingsToStorage(updated);
          return updated;
        });
      }
    };

    try {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } catch {
      mediaQuery.addListener(handleSystemThemeChange);
    }

    return () => {
      try {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      } catch {
        mediaQuery.removeListener(handleSystemThemeChange);
      }
    };
  }, [themeOption]);

  // 1. Single-doc real-time listener for Clinical System Settings from Cloud Firestore
  useEffect(() => {
    const unsub = subscribeToSystemSettings((cloudSettings) => {
      if (cloudSettings) {
        setSettings((prev) => {
          // CRITICAL: NEVER allow cloudSettings from Firestore to overwrite the active user's local language or theme!
          // Shared clinical configurations (features, units, thresholds, templates) sync across devices,
          // but personal preferences (language, theme) remain strictly isolated per user and per browser.
          const currentLang = prev.language || getLocalUserLanguage();
          const currentTheme = prev.theme || getLocalUserTheme();

          const merged: SystemSettings = {
            ...prev,
            ...cloudSettings,
            // Enforce user's local/personal language & theme:
            language: currentLang,
            theme: currentTheme,
            features: {
              ...prev.features,
              ...(cloudSettings.features || {}),
            },
            unit: {
              ...prev.unit,
              ...(cloudSettings.unit || {}),
            },
            notifications: {
              ...prev.notifications,
              ...(cloudSettings.notifications || {}),
              vitalThresholds: {
                ...prev.notifications.vitalThresholds,
                ...(cloudSettings.notifications?.vitalThresholds || {}),
              },
              events: {
                ...prev.notifications.events,
                ...(cloudSettings.notifications?.events || {}),
              }
            },
          };
          saveSettingsToStorage(merged);
          return merged;
        });
      }
    });

    return () => unsub();
  }, []);

  // 2. React to Auth Account changes: switch to that user's personal preferred language if configured
  useEffect(() => {
    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<IcuUser | null>;
      const user = customEvent.detail;
      const targetLang = getLocalUserLanguage(user?.uid);
      setSettings((prev) => {
        if (prev.language === targetLang) return prev;
        const updated = {
          ...prev,
          language: targetLang,
        };
        saveSettingsToStorage(updated);
        return updated;
      });
    };

    window.addEventListener('icu-user-auth-changed', handleAuthChange);
    return () => window.removeEventListener('icu-user-auth-changed', handleAuthChange);
  }, []);

  // 3. Manage HTML root theme class
  useEffect(() => {
    saveSettingsToStorage(settings);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (settings.theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    }
  }, [settings.theme]);

  // Toggle Theme (Strictly local to this browser/device, never overrides other hospital users)
  const toggleTheme = () => {
    setSettings((prev) => {
      const nextTheme = prev.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(USER_THEME_STORAGE_KEY, nextTheme);
      } catch (e) {}
      const updated = {
        ...prev,
        theme: nextTheme,
        lastUpdated: new Date().toISOString(),
      };
      saveSettingsToStorage(updated);
      return updated;
    });
  };

  // Update Settings (Isolates personal preferences vs global unit settings)
  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    // If language is being updated, store it in personal local preference
    if (newSettings.language) {
      const targetLang = newSettings.language;
      try {
        localStorage.setItem(USER_LANG_STORAGE_KEY, targetLang);
        const activeUserRaw = localStorage.getItem('soli_icu_active_user');
        if (activeUserRaw) {
          const activeUser = JSON.parse(activeUserRaw);
          if (activeUser?.uid) {
            localStorage.setItem(`soli_icu_user_lang_${activeUser.uid}`, targetLang);
            // Asynchronously sync preference to user's profile in Firestore without blocking
            setDoc(doc(firestore, 'users', activeUser.uid), { preferredLanguage: targetLang }, { merge: true }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('Failed to save user language preference:', e);
      }
    }

    if (newSettings.theme) {
      try {
        localStorage.setItem(USER_THEME_STORAGE_KEY, newSettings.theme);
      } catch (e) {}
    }

    setSettings((prev) => {
      const updated: SystemSettings = {
        ...prev,
        ...newSettings,
        features: {
          ...prev.features,
          ...(newSettings.features || {}),
        },
        unit: {
          ...prev.unit,
          ...(newSettings.unit || {}),
        },
        notifications: {
          ...prev.notifications,
          ...(newSettings.notifications || {}),
          events: {
            ...prev.notifications.events,
            ...(newSettings.notifications?.events || {}),
          }
        },
        lastUpdated: new Date().toISOString(),
      };
      saveSettingsToStorage(updated);

      // ONLY broadcast to Cloud Firestore if there are global clinical changes (features, unit, drug libraries, etc.)
      // Personal preferences (language, theme) are NEVER broadcast to Cloud to avoid changing other users' accounts!
      const hasGlobalChanges = Object.keys(newSettings).some(key => key !== 'language' && key !== 'theme');
      if (hasGlobalChanges) {
        syncSystemSettingsToCloud(updated);
      }

      return updated;
    });
  };

  const updateNotificationSettings = (newNotifs: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      const updated: SystemSettings = {
        ...prev,
        notifications: {
          ...prev.notifications,
          ...newNotifs,
          events: {
            ...prev.notifications.events,
            ...(newNotifs.events || {}),
          }
        },
        lastUpdated: new Date().toISOString(),
      };
      saveSettingsToStorage(updated);
      syncSystemSettingsToCloud(updated);
      return updated;
    });
  };

  const toggleFeature = (featureKey: keyof SystemSettings['features']) => {
    setSettings((prev) => {
      const updated: SystemSettings = {
        ...prev,
        features: {
          ...prev.features,
          [featureKey]: !prev.features[featureKey],
        },
        lastUpdated: new Date().toISOString(),
      };
      saveSettingsToStorage(updated);
      syncSystemSettingsToCloud(updated);
      return updated;
    });
  };

  const resetToDefaults = () => {
    const currentLang = getLocalUserLanguage();
    const currentTheme = getLocalUserTheme();
    const resetSettings: SystemSettings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      language: currentLang,
      theme: currentTheme,
    };
    setSettings(resetSettings);
    saveSettingsToStorage(resetSettings);
    syncSystemSettingsToCloud(resetSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, themeOption, setThemeOption, updateSettings, updateNotificationSettings, toggleFeature, toggleTheme, resetToDefaults }}>
      {children}
    </SettingsContext.Provider>
  );
};

export function useSystemSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSystemSettings must be used within a SettingsProvider');
  }
  return context;
}
