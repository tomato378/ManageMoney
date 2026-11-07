import type Tesseract from 'tesseract.js';

/**
 * レシート画像をブラウザ内で文字認識する（Tesseract.js）。画像は外部に送信しない。
 * エンジンと日本語モデルは自分のサイトの /ocr/ から読む（scripts/copy-ocr-assets.mjs がコピー）。
 */

export interface OcrProgress {
  /** 画面に出す説明 */
  label: string;
  /** 0〜1 */
  ratio: number;
}

/** 認識前に縮小・白黒化・コントラスト強調して、速く正確にする */
async function prepareImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.filter = 'grayscale(1) contrast(1.4)';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/png'));
}

function progressOf(message: Tesseract.LoggerMessage): OcrProgress {
  // 準備（エンジン・日本語モデルの読み込み）を前半 30%、認識を後半 70% として表示する
  if (message.status === 'recognizing text') {
    return { label: '文字を読み取り中', ratio: 0.3 + message.progress * 0.7 };
  }
  return { label: '読み取りの準備中（初回は少し時間がかかります）', ratio: Math.min(0.3, message.progress * 0.3) };
}

export interface ReceiptReader {
  read(file: Blob, onProgress?: (progress: OcrProgress) => void): Promise<string>;
  close(): Promise<void>;
}

/**
 * 何枚も続けて読むためのリーダー。エンジンと日本語モデルの読み込みは最初の1回だけ。
 * 読み取りは1枚ずつ順番に行う（同時に呼んでも前の分が終わるまで待つ）。
 */
export async function createReceiptReader(onSetupProgress?: (progress: OcrProgress) => void): Promise<ReceiptReader> {
  const { createWorker, OEM } = await import('tesseract.js');
  let listener: ((progress: OcrProgress) => void) | undefined = onSetupProgress;
  // ワーカーは blob URL から動くので、相対パスではなく絶対 URL で渡す
  const base = `${window.location.origin}/ocr`;
  const worker = await createWorker('jpn', OEM.LSTM_ONLY, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/core`,
    langPath: `${base}/lang`,
    logger: (message) => listener?.(progressOf(message)),
  });
  let queue: Promise<unknown> = Promise.resolve();
  return {
    read(file, onProgress) {
      const job = queue.then(async () => {
        listener = onProgress;
        onProgress?.({ label: '画像を準備中', ratio: 0.3 });
        const image = await prepareImage(file);
        const result = await worker.recognize(image);
        return result.data.text;
      });
      queue = job.catch(() => {});
      return job;
    },
    async close() {
      await queue;
      await worker.terminate();
    },
  };
}

export async function recognizeReceipt(file: Blob, onProgress: (progress: OcrProgress) => void): Promise<string> {
  onProgress({ label: '画像を準備中', ratio: 0 });
  const reader = await createReceiptReader(onProgress);
  try {
    return await reader.read(file, onProgress);
  } finally {
    await reader.close();
  }
}
