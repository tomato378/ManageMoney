import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';

import { useData } from '@/data/DataProvider';
import { today } from '@/lib/date';
import { recognizeReceipt, type OcrProgress } from '@/lib/ocr';
import { guessCategoryId, parseReceipt } from '@/lib/receipt';
import type { TransactionInput } from '@/types';
import { Button, Card, ProgressBar, Screen } from '@/ui/components';
import { emptyTransaction, TransactionForm } from '@/ui/TransactionForm';
import { colors, spacing } from '@/ui/theme';

type State =
  | { phase: 'idle' }
  | { phase: 'reading'; progress: OcrProgress }
  | { phase: 'done'; text: string; initial: TransactionInput; missing: string[] }
  | { phase: 'error'; message: string };

/** レシートの写真から合計額・日付・店名・カテゴリを読み取り、入力フォームに入れる */
export default function ReceiptScreen() {
  const { categories, settings } = useData();
  const fileInput = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [showText, setShowText] = useState(false);
  // 読み取りのたびにフォームを作り直して初期値を反映する
  const [formKey, setFormKey] = useState(0);

  // 前の画像のプレビュー用 URL を解放する
  useEffect(() => {
    if (!imageUrl) return;
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  async function read(file: File) {
    setImageUrl(URL.createObjectURL(file));
    setShowText(false);
    setState({ phase: 'reading', progress: { label: '画像を準備中', ratio: 0 } });
    try {
      const text = await recognizeReceipt(file, (progress) => setState({ phase: 'reading', progress }));
      const fields = parseReceipt(text, today());
      const base = emptyTransaction('expense', settings.defaultAccountId);
      const initial: TransactionInput = {
        ...base,
        amount: fields.amount ?? 0,
        date: fields.date ?? base.date,
        memo: fields.storeName ?? '',
        categoryId: guessCategoryId(text, categories),
      };
      const missing = [fields.amount === null && '金額', fields.date === null && '日付'].filter(
        (m): m is string => !!m,
      );
      setFormKey((k) => k + 1);
      setState({ phase: 'done', text, initial, missing });
    } catch (error) {
      setState({ phase: 'error', message: String((error as Error)?.message ?? error) });
    }
  }

  function done() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.caption}>
          レシートを明るい場所で真上から撮ると、合計額・日付・店名・カテゴリを読み取って入力欄に入れます。保存する前に内容を確認してください。
        </Text>
        <Button
          title={state.phase === 'idle' ? '写真を撮る / 画像を選ぶ' : '別の画像を読み取る'}
          variant={state.phase === 'idle' ? 'primary' : 'secondary'}
          onPress={() => fileInput.current?.click()}
          disabled={state.phase === 'reading'}
        />
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          aria-label="レシートの画像"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) read(file);
          }}
        />
        <Text style={styles.note}>画像はこの端末の中だけで処理され、外部には送信されません。</Text>
      </Card>

      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="contain" /> : null}

      {state.phase === 'reading' ? (
        <Card>
          <Text style={styles.progressLabel}>
            {state.progress.label}… {Math.round(state.progress.ratio * 100)}%
          </Text>
          <ProgressBar ratio={state.progress.ratio} />
        </Card>
      ) : null}

      {state.phase === 'error' ? (
        <Card>
          <Text style={styles.error}>読み取りに失敗しました：{state.message}</Text>
        </Card>
      ) : null}

      {state.phase === 'done' ? (
        <>
          {state.missing.length > 0 ? (
            <Text style={styles.warning}>{state.missing.join('と')}を読み取れませんでした。入力してください。</Text>
          ) : (
            <Text style={styles.success}>読み取りました。内容を確認して保存してください。</Text>
          )}
          <TransactionForm key={formKey} before={null} initial={state.initial} onDone={done} />
          <Pressable onPress={() => setShowText(!showText)} accessibilityRole="button">
            <Text style={styles.toggle}>{showText ? '▲ 読み取った文字を隠す' : '▼ 読み取った文字を見る'}</Text>
          </Pressable>
          {showText ? (
            <Card>
              <Text style={styles.rawText}>{state.text.trim() || '（文字が見つかりませんでした）'}</Text>
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 14, color: colors.text, lineHeight: 20 },
  note: { fontSize: 12, color: colors.subText },
  preview: { width: '100%', height: 240, borderRadius: 12, backgroundColor: colors.border },
  progressLabel: { fontSize: 14, color: colors.text },
  error: { fontSize: 14, color: colors.danger },
  warning: { fontSize: 14, color: colors.warning, fontWeight: '600', paddingHorizontal: spacing.xs },
  success: { fontSize: 14, color: colors.income, fontWeight: '600', paddingHorizontal: spacing.xs },
  toggle: { fontSize: 14, color: colors.primary, fontWeight: '600', paddingVertical: spacing.sm },
  rawText: { fontSize: 12, color: colors.subText, fontFamily: 'monospace', lineHeight: 18 },
});
