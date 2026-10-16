import type { ExpoConfig } from 'expo/config';
import type { WithAndroidWidgetsParams } from 'react-native-android-widget';

const widgets: WithAndroidWidgetsParams = {
  widgets: [
    {
      name: 'QuickAdd',
      label: 'ManageMoney クイック入力',
      description: '今月の支出と予算残りを表示し、ワンタップで入力画面を開きます',
      minWidth: '250dp',
      minHeight: '110dp',
      targetCellWidth: 4,
      targetCellHeight: 2,
      maxResizeWidth: '420dp',
      maxResizeHeight: '220dp',
      resizeMode: 'horizontal|vertical',
      // 30分ごとに再描画（日付が変わったときの表示更新用）
      updatePeriodMillis: 1800000,
    },
  ],
};

const config: ExpoConfig = {
  name: 'ManageMoney',
  slug: 'managemoney',
  scheme: 'managemoney',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  android: {
    package: 'com.tomato378.managemoney',
    // EAS Build では file 型の環境変数 GOOGLE_SERVICES_JSON で渡す
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    ['react-native-android-widget', widgets],
  ],
};

export default config;
