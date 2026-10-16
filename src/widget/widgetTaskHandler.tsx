import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { loadWidgetSummary } from './cache';
import { renderQuickAddWidget } from './QuickAddWidget';

/**
 * ウィジェットの追加・定期更新・サイズ変更のときに Android から呼ばれる。
 * ボタンは OPEN_URI でアプリの入力画面を直接開くので、クリックの処理は不要。
 */
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetInfo.widgetName !== 'QuickAdd') return;
  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      renderWidget(renderQuickAddWidget(await loadWidgetSummary()));
      break;
    default:
      break;
  }
}
