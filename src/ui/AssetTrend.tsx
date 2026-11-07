import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import type { AssetPoint } from '@/lib/calc';
import { formatYen } from '@/lib/money';
import { colors } from './theme';

const Y_AXIS_WIDTH = 52;

/** 円を「12.3万」のように短くする（グラフの目盛り用） */
function shortYen(value: number): string {
  if (Math.abs(value) >= 10_000) return `${Math.round(value / 1_000) / 10}万`;
  return String(Math.round(value));
}

/** 月末ごとの総資産の折れ線グラフ。2か月分以上あるときだけ線を引く */
export function AssetTrend({ points }: { points: AssetPoint[] }) {
  const [width, setWidth] = useState(0);
  if (points.length < 2) {
    return <Text style={styles.note}>記録が2か月分たまると、総資産の推移がここに出ます。</Text>;
  }
  const first = points[0].total;
  const last = points[points.length - 1].total;
  const change = last - first;
  const values = points.map((p) => p.total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // 目盛りを変化が見える範囲にするため、下限を少し下げて底上げする
  const offset = min > 0 ? Math.max(0, Math.floor((min - (max - min) * 0.2) / 10_000) * 10_000) : 0;
  const data = points.map((p) => ({
    value: p.total - offset,
    label: `${Number(p.month.slice(5))}月`,
  }));
  const chartWidth = Math.max(0, width - Y_AXIS_WIDTH - 16);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.container}>
      <Text style={styles.change}>
        {points.length}か月で{' '}
        <Text style={{ color: change < 0 ? colors.expense : colors.income }}>
          {change >= 0 ? '+' : ''}
          {formatYen(change)}
        </Text>
      </Text>
      {width > 0 ? (
        <LineChart
          data={data}
          width={chartWidth}
          height={160}
          adjustToWidth
          disableScroll
          initialSpacing={12}
          endSpacing={12}
          thickness={2}
          color={colors.primary}
          areaChart
          startFillColor={colors.primary}
          endFillColor={colors.primary}
          startOpacity={0.25}
          endOpacity={0.02}
          dataPointsColor={colors.primary}
          noOfSections={4}
          yAxisLabelWidth={Y_AXIS_WIDTH}
          formatYLabel={(label) => shortYen(Number(label) + offset)}
          yAxisTextStyle={styles.axisText}
          xAxisLabelTextStyle={styles.axisText}
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          rulesColor={colors.border}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  note: { fontSize: 13, color: colors.subText },
  change: { fontSize: 14, color: colors.text, fontWeight: '600' },
  axisText: { fontSize: 10, color: colors.subText },
});
