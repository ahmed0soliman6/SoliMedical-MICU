/**
 * Soli Medical MICU (ICU-Sync)
 * Centralized Firebase Configuration
 * 
 * Sources configuration values from Vite environment variables (VITE_FIREBASE_*)
 * with fallback to the local project firebase-applet-config.json.
 */

import rawAppletConfig from '../../../firebase-applet-config.json';

export interface FirebaseConfigType {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

export const firebaseConfig: FirebaseConfigType = {
  apiKey: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_API_KEY) || rawAppletConfig.apiKey || '',
  authDomain: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN) || rawAppletConfig.authDomain || '',
  projectId: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID) || rawAppletConfig.projectId || 'solimedical-micu',
  storageBucket: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET) || rawAppletConfig.storageBucket || '',
  messagingSenderId: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || rawAppletConfig.messagingSenderId || '',
  appId: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_APP_ID) || rawAppletConfig.appId || '',
  measurementId: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID) || rawAppletConfig.measurementId || '',
  firestoreDatabaseId: rawAppletConfig.firestoreDatabaseId || '',
};

export default firebaseConfig;
