import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { SystemSettings, DEFAULT_SYSTEM_SETTINGS } from '../types/settings.ts';

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
      features: {
        ...DEFAULT_SYSTEM_SETTINGS.features,
        ...(parsed.features || {}),
      },
      unit: {
        ...DEFAULT_SYSTEM_SETTINGS.unit,
        ...(parsed.unit || {}),
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
  toggleFeature: (featureKey: keyof SystemSettings['features']) => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SystemSettings>(loadSavedSettings);

  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

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
        lastUpdated: new Date().toISOString(),
      };
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
      return updated;
    });
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SYSTEM_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, toggleFeature, resetToDefaults }}>
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
