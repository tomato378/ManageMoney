import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { WidgetSummary } from './summary';

const KEY = 'widget:summary';

/** ウィジェットはアプリ外（ヘッドレスタスク）で描画されるので、表示内容をキャッシュから読む */
export async function loadWidgetSummary(): Promise<WidgetSummary | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WidgetSummary) : null;
  } catch {
    return null;
  }
}

export async function saveWidgetSummary(summary: WidgetSummary | null) {
  const raw = summary ? JSON.stringify(summary) : null;
  if (raw === (await AsyncStorage.getItem(KEY))) return;
  if (raw) await AsyncStorage.setItem(KEY, raw);
  else await AsyncStorage.removeItem(KEY);
  await refreshWidgets(summary);
}

async function refreshWidgets(summary: WidgetSummary | null) {
  if (Platform.OS !== 'android') return;
  // ウィジェット関連のモジュールは Android でだけ読み込む
  const [{ requestWidgetUpdate }, { renderQuickAddWidget }] = await Promise.all([
    import('react-native-android-widget'),
    import('./QuickAddWidget'),
  ]);
  await requestWidgetUpdate({
    widgetName: 'QuickAdd',
    renderWidget: () => renderQuickAddWidget(summary),
  });
}
