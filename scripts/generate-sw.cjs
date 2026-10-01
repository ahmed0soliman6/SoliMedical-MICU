const fs = require('fs');
const path = require('path');

// Load environment variables from .env if dotenv is installed
try {
  require('dotenv').config();
} catch (e) {
  // dotenv optional
}

let appletConfig = {};
try {
  const cfgPath = path.resolve(__dirname, '../firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    appletConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
} catch (e) {
  console.warn('[generate-sw] Could not read firebase-applet-config.json:', e);
}

const apiKey = process.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '';
const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || 'solimedical-micu.firebaseapp.com';
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || 'solimedical-micu';
const storageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || 'solimedical-micu.firebasestorage.app';
const messagingSenderId = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '356354051601';
const appId = process.env.VITE_FIREBASE_APP_ID || appletConfig.appId || '';

if (!apiKey) {
  console.warn('[generate-sw] WARNING: apiKey is empty! Make sure VITE_FIREBASE_API_KEY or firebase-applet-config.json is configured.');
}

const templatePath = path.resolve(__dirname, 'firebase-messaging-sw.template.js');
let content = fs.readFileSync(templatePath, 'utf8');

content = content
  .replace('__FIREBASE_API_KEY__', apiKey)
  .replace('__FIREBASE_AUTH_DOMAIN__', authDomain)
  .replace('__FIREBASE_PROJECT_ID__', projectId)
  .replace('__FIREBASE_STORAGE_BUCKET__', storageBucket)
  .replace('__FIREBASE_MESSAGING_SENDER_ID__', messagingSenderId)
  .replace('__FIREBASE_APP_ID__', appId);

const publicPath = path.resolve(__dirname, '../public/firebase-messaging-sw.js');
fs.writeFileSync(publicPath, content, 'utf8');
console.log(`[generate-sw] Generated ${publicPath} (apiKey length: ${apiKey.length})`);

const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  const distPath = path.join(distDir, 'firebase-messaging-sw.js');
  fs.writeFileSync(distPath, content, 'utf8');
  console.log(`[generate-sw] Updated ${distPath}`);
}
