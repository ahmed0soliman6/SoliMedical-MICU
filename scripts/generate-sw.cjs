const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const templatePath = path.resolve(__dirname, 'firebase-messaging-sw.template.js');
let content = '';
if (fs.existsSync(templatePath)) {
  content = fs.readFileSync(templatePath, 'utf8');
} else {
  const publicSw = path.resolve(__dirname, '../public/firebase-messaging-sw.js');
  if (fs.existsSync(publicSw)) {
    content = fs.readFileSync(publicSw, 'utf8');
  }
}

const vars = {
  VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyA5NDAjz9mgzpkia99CIMkUSiEPg3hLQ9U',
  VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'solimedical-micu.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || 'solimedical-micu',
  VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'solimedical-micu.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '356354051601',
  VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID || '1:356354051601:web:f2e0510dc522804d4dabb0',
  VITE_FIREBASE_VAPID_KEY: process.env.VITE_FIREBASE_VAPID_KEY || 'BHx7GBa3Ol-ZsDcn5Dtui80q8SooxmuDlosFMQRukBOX6BmbyYYhpAEjQ5y_CLmImiqu5EE79nlzcjJcWwK4ktM',
};

for (const [k, v] of Object.entries(vars)) {
  content = content.replaceAll(`__${k}__`, v);
}

const outPublic = path.resolve(__dirname, '../public/firebase-messaging-sw.js');
fs.mkdirSync(path.dirname(outPublic), { recursive: true });
fs.writeFileSync(outPublic, content);
console.log(`[generate-sw] Generated ${outPublic} (apiKey length: ${vars.VITE_FIREBASE_API_KEY.length})`);

const outDist = path.resolve(__dirname, '../dist/firebase-messaging-sw.js');
if (fs.existsSync(path.dirname(outDist))) {
  fs.writeFileSync(outDist, content);
  console.log(`[generate-sw] Updated ${outDist}`);
}
