import { FlexWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

import { formatMonth } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { quickAddUri, type WidgetButton, type WidgetSummary } from './summary';

const COLORS = {
  background: '#FFFFFF',
  text: '#111827',
  subText: '#6B7280',
  expense: '#DC2626',
  income: '#16A34A',
  danger: '#DC2626',
} as const;

function Button({ label, color, uri, filled }: WidgetButton & { filled?: boolean }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      accessibilityLabel={`${label}を入力`}
      style={{
        flex: 1,
        height: 'match_parent',
        marginHorizontal: 3,
        borderRadius: 12,
        backgroundColor: (filled ? color : `${color}22`) as ColorProp,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <TextWidget
        text={label}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 14, fontWeight: 'bold', color: (filled ? '#FFFFFF' : color) as ColorProp }}
      />
    </FlexWidget>
  );
}

export function QuickAddWidget({ summary }: { summary: WidgetSummary | null }) {
  if (!summary) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: COLORS.background,
          borderRadius: 20,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <TextWidget text="ManageMoney" style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.text }} />
        <TextWidget text="タップしてログイン" style={{ fontSize: 13, color: COLORS.subText, marginTop: 4 }} />
      </FlexWidget>
    );
  }

  const remaining = summary.budgetRemaining;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: COLORS.background,
        borderRadius: 20,
        padding: 10,
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        clickAction="OPEN_APP"
        style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}
      >
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={`${formatMonth(summary.month)}の支出`} style={{ fontSize: 11, color: COLORS.subText }} />
          <TextWidget
            text={formatYen(summary.expense)}
            style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.text }}
          />
        </FlexWidget>
        {remaining !== null ? (
          <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
            <TextWidget text="予算残り" style={{ fontSize: 11, color: COLORS.subText }} />
            <TextWidget
              text={formatYen(remaining)}
              style={{ fontSize: 18, fontWeight: 'bold', color: remaining < 0 ? COLORS.danger : COLORS.income }}
            />
          </FlexWidget>
        ) : null}
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'row', marginTop: 8 }}>
        <Button label="－ 支出" color={COLORS.expense} uri={quickAddUri({ kind: 'expense' })} filled />
        <Button label="＋ 収入" color={COLORS.income} uri={quickAddUri({ kind: 'income' })} filled />
      </FlexWidget>

      {summary.categoryButtons.length > 0 ? (
        <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'row', marginTop: 6 }}>
          {summary.categoryButtons.map((button) => (
            <Button key={button.uri} {...button} />
          ))}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

export function renderQuickAddWidget(summary: WidgetSummary | null) {
  return <QuickAddWidget summary={summary} />;
}
