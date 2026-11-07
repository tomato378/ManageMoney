import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { addTransaction } from '@/data/repo';
import { getSnapshot } from '@/data/store';
import { formatDate, today } from '@/lib/date';
import { formatYen, parseAmount } from '@/lib/money';
import { createReceiptReader, type ReceiptReader } from '@/lib/ocr';
import { readingFromText, REVIEW_REASON_LABELS, type ReceiptReading } from '@/lib/receipt';
import type { TransactionInput } from '@/types';
import { Button, Card, Chip, ChipRow, Field, Input, ProgressBar, Screen, SectionTitle } from '@/ui/components';
import { DateInput } from '@/ui/DateInput';
import { TransactionRow } from '@/ui/rows';
import { colors, radius, spacing } from '@/ui/theme';

type ItemStatus = 'waiting' | 'reading' | 'saved' | 'review' | 'discarded' | 'error';

interface ScanItem {
  id: string;
  /** 確認が必要なものだけ表示用に残す。記録したら解放する */
  url: string | null;
  status: ItemStatus;
  reading?: ReceiptReading;
  txId?: string;
  error?: string;
}

type CameraState = { phase: 'starting' } | { phase: 'on' } | { phase: 'off'; message: string };

/**
 * たまったレシートをまとめて撮って記録する画面。
 * 撮った画像はこの画面の中（メモリ）にだけ置き、端末の写真には保存しない。読み取りが済んだら捨てる。
 * 金額と日付が読めて二重登録でもないものは自動で記録し、怪しいものだけ確認に回す。
 */
export default function ScanScreen() {
  const { transactions, categories, accounts } = useData();
  const [items, setItems] = useState<ScanItem[]>([]);
  const [camera, setCamera] = useState<CameraState>({ phase: 'starting' });
  const [setup, setSetup] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const blobs = useRef(new Map<string, Blob>());
  const queue = useRef<string[]>([]);
  const readerRef = useRef<Promise<ReceiptReader> | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  /** まだ解放していない表示用の画像 URL（画面を離れたら全部捨てる） */
  const urls = useRef(new Set<string>());

  const releaseUrl = useCallback((url: string | null) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }, []);

  const patch = useCallback((id: string, change: Partial<ScanItem>) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }, []);

  // ---- カメラ ----

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera({ phase: 'off', message: 'このブラウザではカメラを使えません。「画像を選ぶ」から読み込んでください。' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamera({ phase: 'on' });
    } catch {
      setCamera({
        phase: 'off',
        message: 'カメラを使えませんでした（許可されていないか、カメラがありません）。「画像を選ぶ」から読み込めます。',
      });
    }
  }, []);

  // ---- 読み取り（1枚ずつ順番に） ----

  const getReader = useCallback(() => {
    if (!readerRef.current) {
      setSetup(0);
      readerRef.current = createReceiptReader((p) => mounted.current && setSetup(p.ratio / 0.3)).finally(
        () => mounted.current && setSetup(null),
      );
      readerRef.current.catch(() => {
        readerRef.current = null;
      });
    }
    return readerRef.current;
  }, []);

  const processQueue = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (queue.current.length > 0 && mounted.current) {
        const id = queue.current.shift()!;
        const blob = blobs.current.get(id);
        if (!blob) continue;
        patch(id, { status: 'reading' });
        try {
          const reader = await getReader();
          const text = await reader.read(blob);
          // 同じ回に撮った分も二重登録の判定に入れるため、最新のデータで判定する
          const data = getSnapshot();
          const reading = readingFromText(text, today(), data);
          blobs.current.delete(id);
          if (reading.reasons.length === 0) {
            const txId = addTransaction(reading.input);
            setItems((list) =>
              list.map((item) => {
                if (item.id !== id) return item;
                releaseUrl(item.url);
                return { ...item, status: 'saved', url: null, reading, txId };
              }),
            );
          } else {
            patch(id, { status: 'review', reading });
          }
        } catch (error) {
          patch(id, { status: 'error', error: String((error as Error)?.message ?? error) });
        }
      }
    } finally {
      running.current = false;
    }
  }, [getReader, patch, releaseUrl]);

  const addImage = useCallback(
    (blob: Blob) => {
      const id = crypto.randomUUID();
      blobs.current.set(id, blob);
      queue.current.push(id);
      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      setItems((list) => [...list, { id, url, status: 'waiting' }]);
      processQueue();
    },
    [processQueue],
  );

  function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && addImage(blob), 'image/jpeg', 0.92);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
  }

  useEffect(() => {
    mounted.current = true;
    // 画面を開いたらすぐカメラを起動する（許可を求められる）。状態の更新は起動が済んでから
    void Promise.resolve().then(startCamera);
    const blobMap = blobs.current;
    const urlSet = urls.current;
    return () => {
      mounted.current = false;
      stopCamera();
      readerRef.current?.then((r) => r.close()).catch(() => {});
      blobMap.clear();
      urlSet.forEach((url) => URL.revokeObjectURL(url));
      urlSet.clear();
    };
  }, [startCamera, stopCamera]);


  const pending = items.filter((i) => i.status === 'waiting' || i.status === 'reading').length;
  const reviews = items.filter((i) => i.status === 'review' || i.status === 'error');
  const saved = items.filter((i) => i.status === 'saved');
  const finished = items.length > 0 && pending === 0 && reviews.length === 0;

  // 読み取り中にタブを閉じようとしたら止める
  useEffect(() => {
    if (pending === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  function resolve(item: ScanItem, input: TransactionInput | null) {
    releaseUrl(item.url);
    if (input) {
      const txId = addTransaction(input);
      patch(item.id, { status: 'saved', url: null, txId });
    } else {
      patch(item.id, { status: 'discarded', url: null });
    }
  }

  const savedTotal = saved.reduce((sum, i) => sum + (i.reading?.input.amount ?? 0), 0);

  return (
    <Screen>
      <Card>
        <View style={styles.cameraBox}>
          <video ref={videoRef} playsInline muted autoPlay style={videoStyle} />
          {camera.phase !== 'on' ? (
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraMessage}>
                {camera.phase === 'starting' ? 'カメラを起動しています…' : camera.message}
              </Text>
            </View>
          ) : null}
          {flash ? <View style={styles.flash} /> : null}
        </View>
        <Pressable
          onPress={shoot}
          disabled={camera.phase !== 'on'}
          style={({ pressed }) => [
            styles.shutter,
            { opacity: camera.phase !== 'on' ? 0.4 : pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="撮る"
        >
          <Text style={styles.shutterText}>📷 撮る{items.length > 0 ? `（${items.length}枚目まで撮影済み）` : ''}</Text>
        </Pressable>
        <Text style={styles.note}>
          1枚ずつ真上から、明るい場所で撮ってください。撮るたびに裏で読み取ります。写真は端末に保存されず、読み取りが済んだら消えます。
        </Text>
        <View style={styles.subActions}>
          <Button title="画像を選ぶ" variant="secondary" onPress={() => fileInput.current?.click()} />
          {camera.phase === 'off' ? (
            <Button
              title="カメラを再試行"
              variant="secondary"
              onPress={() => {
                setCamera({ phase: 'starting' });
                startCamera();
              }}
            />
          ) : null}
        </View>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          aria-label="レシートの画像"
          style={{ display: 'none' }}
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = '';
            files.forEach(addImage);
          }}
        />
      </Card>

      {items.length > 0 ? (
        <Card>
          <SectionTitle title={`読み取り ${items.length - pending}/${items.length}枚`} />
          <ProgressBar ratio={items.length ? (items.length - pending) / items.length : 0} />
          {setup !== null ? (
            <Text style={styles.note}>読み取りの準備中（初回は少し時間がかかります）… {Math.round(setup * 100)}%</Text>
          ) : pending > 0 ? (
            <Text style={styles.note}>読み取り中です。この画面を開いたままにしてください（撮影は続けられます）。</Text>
          ) : null}
          <Text style={styles.summary}>
            自動で記録：{saved.length}件（{formatYen(savedTotal)}） ／ 確認待ち：{reviews.length}件
          </Text>
        </Card>
      ) : null}

      {reviews.length > 0 ? <SectionTitle title="確認してください" /> : null}
      {reviews.map((item) => (
        <ReviewCard key={item.id} item={item} onResolve={(input) => resolve(item, input)} />
      ))}

      {finished ? (
        <Card style={styles.doneCard}>
          <Text style={styles.doneTitle}>✅ 全部記録しました</Text>
          <Text style={styles.doneText}>
            {saved.length}件・合計 {formatYen(savedTotal)}。撮ったレシートは捨てて大丈夫です。
          </Text>
          <Button title="ホームに戻る" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </Card>
      ) : null}

      {saved.length > 0 ? (
        <Card>
          <SectionTitle title="記録したもの" />
          <Text style={styles.note}>間違っていたら押して直せます。</Text>
          {saved
            .map((item) => transactions.find((t) => t.id === item.txId))
            .filter((tx) => !!tx)
            .reverse()
            .map((tx) => (
              <TransactionRow key={tx.id} tx={tx} categories={categories} accounts={accounts} showDate />
            ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function ReviewCard({ item, onResolve }: { item: ScanItem; onResolve: (input: TransactionInput | null) => void }) {
  const { categories, accounts } = useData();
  const initial = item.reading?.input;
  const [amountText, setAmountText] = useState(initial?.amount ? String(initial.amount) : '');
  const [date, setDate] = useState(initial?.date ?? today());
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? null);
  const [accountId, setAccountId] = useState(initial?.accountId ?? null);
  const expenseCategories = categories.filter((c) => c.kind === 'expense');
  const amount = parseAmount(amountText);

  const reasons =
    item.status === 'error'
      ? [`読み取りに失敗しました：${item.error ?? ''}`]
      : (item.reading?.reasons ?? []).map((r) => REVIEW_REASON_LABELS[r]);

  return (
    <Card>
      <View style={styles.reviewHead}>
        {item.url ? <Image source={{ uri: item.url }} style={styles.thumb} resizeMode="cover" /> : null}
        <View style={styles.reviewReasons}>
          {reasons.map((r) => (
            <Text key={r} style={styles.warning}>
              ⚠ {r}
            </Text>
          ))}
        </View>
      </View>
      <Field label="金額">
        <Input value={amountText} onChangeText={setAmountText} keyboardType="number-pad" placeholder="¥0" />
      </Field>
      <Field label={`日付：${formatDate(date)}`}>
        <DateInput value={date} onChange={setDate} label="日付" />
      </Field>
      <Field label="店名・メモ">
        <Input value={memo} onChangeText={setMemo} placeholder="任意" />
      </Field>
      <Field label="カテゴリ">
        <ChipRow>
          {expenseCategories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              icon={c.icon}
              color={c.color}
              selected={c.id === categoryId}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </ChipRow>
      </Field>
      <Field label="支払った口座">
        <ChipRow>
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} selected={a.id === accountId} onPress={() => setAccountId(a.id)} />
          ))}
        </ChipRow>
      </Field>
      <View style={styles.subActions}>
        <View style={styles.flex}>
          <Button
            title="記録する"
            disabled={!amount}
            onPress={() =>
              amount &&
              onResolve({
                kind: 'expense',
                amount,
                date,
                memo: memo.trim(),
                categoryId,
                accountId,
                toAccountId: null,
              })
            }
          />
        </View>
        <View style={styles.flex}>
          <Button title="記録しない" variant="secondary" onPress={() => onResolve(null)} />
        </View>
      </View>
    </Card>
  );
}

const videoStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  backgroundColor: '#000',
  display: 'block',
} as const;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cameraBox: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 520,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  cameraOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  cameraMessage: { color: '#FFFFFF', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', opacity: 0.7 },
  shutter: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
  },
  shutterText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  note: { fontSize: 12, color: colors.subText, lineHeight: 18 },
  subActions: { flexDirection: 'row', gap: spacing.sm },
  summary: { fontSize: 14, color: colors.text, fontWeight: '600' },
  reviewHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  thumb: { width: 72, height: 96, borderRadius: radius.sm, backgroundColor: colors.border },
  reviewReasons: { flex: 1, gap: spacing.xs },
  warning: { fontSize: 14, color: colors.warning, fontWeight: '600' },
  doneCard: { borderWidth: 2, borderColor: colors.income },
  doneTitle: { fontSize: 18, fontWeight: '700', color: colors.income },
  doneText: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
