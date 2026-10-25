import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'ManageMoney',
  slug: 'managemoney',
  scheme: 'managemoney',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  web: {
    // SPA として 1 枚の index.html を出力する（Vercel 側で全パスを index.html に rewrite）
    output: 'single',
    name: 'ManageMoney',
    shortName: 'ManageMoney',
    lang: 'ja',
    themeColor: '#2563EB',
    backgroundColor: '#F3F4F6',
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-router'],
};

export default config;
