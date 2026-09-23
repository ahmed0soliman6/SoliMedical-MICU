import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { SystemSettings, DEFAULT_SYSTEM_SETTINGS, DEFAULT_NOTIFICATION_SETTINGS, NotificationSettings } from '../types/settings.ts';
import { subscribeToSystemSettings, syncSystemSettingsToCloud } from './firebase.ts';

const SETTINGS_STORAGE_KEY = 'soli_medical_icu_settings_v1';

export function loadSavedSettings(): SystemSettings {
  if (typeof window === 'undefined') return DEFAULT_SYSTEM_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SYSTEM_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...parsed,
      theme: parsed.theme || 'light',
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
    return DEFAULT_SYSTEM_SETTINGS;
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
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  updateNotificationSettings: (newNotifs: Partial<NotificationSettings>) => void;
  toggleFeature: (featureKey: keyof SystemSettings['features']) => void;
  toggleTheme: () => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SystemSettings>(loadSavedSettings);

  // Single-doc real-time listener for Settings from Cloud Firestore
  useEffect(() => {
    const unsub = subscribeToSystemSettings((cloudSettings) => {
      if (cloudSettings) {
        setSettings((prev) => {
          const merged: SystemSettings = {
            ...prev,
            ...cloudSettings,
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
  }, [settings]);

  const toggleTheme = () => {
    setSettings((prev) => {
      const nextTheme = prev.theme === 'dark' ? 'light' : 'dark';
      const updated = {
        ...prev,
        theme: nextTheme,
        lastUpdated: new Date().toISOString(),
      };
      saveSettingsToStorage(updated);
      syncSystemSettingsToCloud(updated);
      return updated;
    });
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
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
      syncSystemSettingsToCloud(updated);
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
    setSettings(DEFAULT_SYSTEM_SETTINGS);
    saveSettingsToStorage(DEFAULT_SYSTEM_SETTINGS);
    syncSystemSettingsToCloud(DEFAULT_SYSTEM_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, updateNotificationSettings, toggleFeature, toggleTheme, resetToDefaults }}>
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
