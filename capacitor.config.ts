import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solimedical.micu',
  appName: 'Soli Medical MICU',
  webDir: 'dist',
  server: {
    url: 'https://solimedical-micu.vercel.app/',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#070d18',
  },
};

export default config;
