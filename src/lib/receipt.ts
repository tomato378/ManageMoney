import type { Account, AppSettings, Category, PaymentMethod, Transaction, TransactionInput } from '@/types';
import { addDays, toDateString } from './date';

/**
 * レシートの文字認識（OCR）結果から合計額・日付・店名を取り出す。
 * OCR は「合 計 ￥ 1, 234」のように空白や全角が混じるので、行ごとに整えてから探す。
 */

export interface ReceiptFields {
  amount: number | null;
  /** YYYY-MM-DD */
  date: string | null;
  storeName: string | null;
}

const MAX_AMOUNT = 10_000_000;

/** 全角→半角、日本語の文字間や数字の間の余計な空白を詰める */
export function normalizeLine(line: string): string {
  return line
    .normalize('NFKC')
    .replace(/\\/g, '¥')
    .replace(/(?<=[^\x00-\x7F¥])\s+(?=[^\x00-\x7F¥])/g, '')
    .replace(/(?<=\d)\s*([,.])\s*(?=\d{3}(?!\d))/g, '$1')
    .replace(/(?<=¥)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function linesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((l) => l.length > 0);
}

/** 行の中の金額らしい数（右端のもの）。点数・パーセント・時刻は除く */
function amountIn(line: string): number | null {
  const cleaned = line
    .replace(/\d+\s*点/g, '')
    .replace(/\d+(\.\d+)?\s*%/g, '')
    .replace(/\d{1,2}:\d{2}/g, '');
  const matches = cleaned.match(/\d{1,3}(?:[,.]\d{3})+|\d+/g);
  if (!matches) return null;
  const value = Number(matches[matches.length - 1].replace(/[,.]/g, ''));
  return value > 0 && value <= MAX_AMOUNT ? value : null;
}

const TOTAL_KEYWORDS = ['合計', 'お買上', 'お買い上げ', 'お会計', 'ご請求', '総計', '現計', 'お支払', '支払金額'];
const SUBTOTAL_KEYWORDS = ['小計'];
/** 合計と書いてあっても合計額ではない行（お預り・お釣り・税の内訳など） */
const EXCLUDE_KEYWORDS = ['預', '釣', '対象', '消費税', '税額', 'ポイント', '値引', '割引'];

function compact(line: string): string {
  return line.replace(/\s+/g, '');
}

function isExcluded(line: string): boolean {
  const c = compact(line);
  return EXCLUDE_KEYWORDS.some((k) => c.includes(k));
}

function amountForKeywords(lines: string[], keywords: string[]): number | null {
  const found: number[] = [];
  lines.forEach((line, i) => {
    const c = compact(line);
    if (!keywords.some((k) => c.includes(k)) || isExcluded(line)) return;
    // 金額が次の行に分かれて読まれることがある
    const value = amountIn(line) ?? (lines[i + 1] && !isExcluded(lines[i + 1]) ? amountIn(lines[i + 1]) : null);
    if (value !== null) found.push(value);
  });
  return found.length > 0 ? Math.max(...found) : null;
}

export function findTotal(lines: string[]): number | null {
  const total = amountForKeywords(lines, TOTAL_KEYWORDS) ?? amountForKeywords(lines, SUBTOTAL_KEYWORDS);
  if (total !== null) return total;
  // 合計の行が読めなかったときは、¥ か 円 が付いた金額のうち最大のもの
  const marked = lines
    .filter((l) => /¥|円/.test(l) && !isExcluded(l))
    .map(amountIn)
    .filter((v): v is number => v !== null);
  return marked.length > 0 ? Math.max(...marked) : null;
}

function validDate(y: number, m: number, d: number, today: string): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1) return null;
  const value = toDateString(date);
  // 未来の日付や 2 年以上前は読み間違いとみなす
  if (value > addDays(today, 1) || value < addDays(today, -730)) return null;
  return value;
}

export function findDate(lines: string[], today: string): string | null {
  // 日付と時刻がつながらないよう、空白は詰めずに \s* で許す
  for (const c of lines) {
    let m = c.match(/(20\d{2})\s*[年/\-.]\s*(\d{1,2})\s*[月/\-.]\s*(\d{1,2})(?!\d)/);
    if (m) {
      const value = validDate(+m[1], +m[2], +m[3], today);
      if (value) return value;
    }
    m = c.match(/令和\s*(\d{1,2}|元)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (m) {
      const value = validDate(2018 + (m[1] === '元' ? 1 : +m[1]), +m[2], +m[3], today);
      if (value) return value;
    }
    m = c.match(/(?<!\d)(\d{2})[/.\-](\d{1,2})[/.\-](\d{1,2})(?!\d)/);
    if (m) {
      const value = validDate(2000 + +m[1], +m[2], +m[3], today);
      if (value) return value;
    }
    m = c.match(/(?<!\d)(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (m) {
      const year = +today.slice(0, 4);
      const value = validDate(year, +m[1], +m[2], today) ?? validDate(year - 1, +m[1], +m[2], today);
      if (value) return value;
    }
  }
  return null;
}

const NOT_STORE_NAME = [
  '領収',
  'レシート',
  'TEL',
  'Tel',
  'tel',
  '電話',
  '〒',
  'No.',
  '登録番号',
  'http',
  'www',
  '様',
  'ありがとう',
  'いらっしゃい',
  'またのご来店',
];

export function findStoreName(lines: string[]): string | null {
  for (const line of lines.slice(0, 6)) {
    const c = compact(line);
    const letters = c.match(/[A-Za-z぀-ヿ一-鿿]/g)?.length ?? 0;
    const digits = c.match(/\d/g)?.length ?? 0;
    if (letters < 2 || digits > letters / 2) continue;
    if (NOT_STORE_NAME.some((k) => c.includes(k))) continue;
    if (/¥|円|合計|小計/.test(c)) continue;
    const name = line.replace(/^[^A-Za-z0-9぀-ヿ一-鿿]+|[^A-Za-z0-9぀-ヿ一-鿿)）]+$/g, '');
    if (name.length >= 2) return name.slice(0, 30);
  }
  return null;
}

export function parseReceipt(text: string, today: string): ReceiptFields {
  const lines = linesOf(text);
  return { amount: findTotal(lines), date: findDate(lines, today), storeName: findStoreName(lines) };
}

/** キーワード → 既定のカテゴリ ID。上から順に調べる（調剤薬局は「医療」、ほかの薬局は「日用品」など） */
const CATEGORY_RULES: { categoryId: string; keywords: string[] }[] = [
  { categoryId: 'medical', keywords: ['病院', 'クリニック', '医院', '歯科', '調剤', '処方', '診療'] },
  {
    categoryId: 'transport',
    keywords: [
      'タクシー',
      'JR',
      '鉄道',
      '乗車',
      '運賃',
      'ガソリン',
      'ENEOS',
      'エネオス',
      '出光',
      'コスモ石油',
      '駐車',
      'パーキング',
    ],
  },
  {
    categoryId: 'daily',
    keywords: [
      'ドラッグ',
      'マツモトキヨシ',
      'マツキヨ',
      'ウエルシア',
      'ツルハ',
      '薬局',
      'ダイソー',
      'DAISO',
      'セリア',
      'キャンドゥ',
      '無印良品',
      'ニトリ',
      'ホームセンター',
      'カインズ',
      'コーナン',
      '洗剤',
      'ティッシュ',
      'トイレットペーパー',
    ],
  },
  { categoryId: 'clothes', keywords: ['ユニクロ', 'UNIQLO', 'GU', 'しまむら', 'ZARA', 'H&M', 'ABC-MART'] },
  {
    categoryId: 'hobby',
    keywords: ['書店', 'ブックオフ', 'BOOKOFF', 'TSUTAYA', '映画', 'シネマ', 'ゲーム', 'カラオケ', 'アニメイト'],
  },
  {
    categoryId: 'food',
    keywords: [
      'スーパー',
      'イオン',
      'AEON',
      'イトーヨーカドー',
      '西友',
      'マルエツ',
      'オーケー',
      'セブン-イレブン',
      'セブンイレブン',
      'ローソン',
      'LAWSON',
      'ファミリーマート',
      'FamilyMart',
      'ミニストップ',
      'マクドナルド',
      'McDonald',
      'スターバックス',
      'STARBUCKS',
      'ドトール',
      'すき家',
      '吉野家',
      '松屋',
      'ガスト',
      'サイゼリヤ',
      '食堂',
      '弁当',
      '食品',
      'レストラン',
      'カフェ',
      'ベーカリー',
      'おにぎり',
      '惣菜',
    ],
  },
];

function containsKeyword(text: string, keyword: string): boolean {
  // 英字の短いキーワード（GU・JR など）は単語として一致したときだけ
  if (/^[A-Za-z&-]+$/.test(keyword)) {
    return new RegExp(`(^|[^A-Za-z])${keyword.replace(/[-&]/g, '\\$&')}([^A-Za-z]|$)`, 'i').test(text);
  }
  return text.includes(keyword);
}

/** レシートの文字からカテゴリを推測する。ユーザーのカテゴリにない ID は返さない */
export function guessCategoryId(text: string, categories: Pick<Category, 'id' | 'kind'>[]): string | null {
  const normalized = linesOf(text).map(compact).join('\n');
  for (const rule of CATEGORY_RULES) {
    if (!categories.some((c) => c.id === rule.categoryId && c.kind === 'expense')) continue;
    if (rule.keywords.some((k) => containsKeyword(normalized, k))) return rule.categoryId;
  }
  return null;
}

/** 支払い方法を表す言葉。電子マネーはクレジットより先に調べる（「iD」「QUICPay」はカード連動でも電子マネー扱い） */
const PAYMENT_RULES: { method: PaymentMethod; keywords: string[] }[] = [
  {
    method: 'emoney',
    keywords: [
      'PayPay',
      'ペイペイ',
      '楽天ペイ',
      'd払い',
      'au PAY',
      'auPAY',
      'メルペイ',
      'LINE Pay',
      'Suica',
      'スイカ',
      'PASMO',
      'ICOCA',
      '交通系',
      'WAON',
      'nanaco',
      '楽天Edy',
      'Edy',
      'QUICPay',
      'iD',
      '電子マネー',
      'コード決済',
      'QR決済',
    ],
  },
  {
    method: 'credit',
    keywords: ['クレジット', 'CREDIT', 'VISA', 'Mastercard', 'MasterCard', 'JCB', 'AMEX', 'Diners', 'カード支払', 'カード払', 'クレカ'],
  },
  { method: 'cash', keywords: ['お預り', 'お預かり', '預り', 'お釣', 'おつり', '釣銭', '現金'] },
];

/** 「iD」のような短い英字は「会員ID」と区別するため大文字小文字も一致させる */
function paymentKeywordIn(text: string, keyword: string): boolean {
  if (/^[A-Za-z]{1,3}$/.test(keyword)) return new RegExp(`(^|[^A-Za-z])${keyword}([^A-Za-z]|$)`).test(text);
  return containsKeyword(text, keyword);
}

/** レシートの文字から支払い方法を推測する。わからなければ null */
export function findPaymentMethod(text: string): PaymentMethod | null {
  const normalized = linesOf(text).map(compact).join('\n');
  for (const rule of PAYMENT_RULES) {
    if (rule.keywords.some((k) => paymentKeywordIn(normalized, k.replace(/\s+/g, '')))) return rule.method;
  }
  return null;
}

export type ReviewReason = 'amount' | 'date' | 'duplicate';

/**
 * 自動で記録してよいか。金額・日付が読めなかったもの、
 * 同じ日・同じ金額の支出がすでにある（二重に撮った・前に記録済み）ものは確認に回す。
 */
export function reviewReasons(
  fields: ReceiptFields,
  existing: Pick<Transaction, 'kind' | 'date' | 'amount'>[],
): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (fields.amount === null) reasons.push('amount');
  if (fields.date === null) reasons.push('date');
  if (
    fields.amount !== null &&
    fields.date !== null &&
    existing.some((t) => t.kind === 'expense' && t.date === fields.date && t.amount === fields.amount)
  ) {
    reasons.push('duplicate');
  }
  return reasons;
}

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  amount: '金額を読み取れませんでした',
  date: '日付を読み取れませんでした',
  duplicate: '同じ日・同じ金額の支出がすでにあります',
};

const ACCOUNT_TYPE_FOR_PAYMENT: Record<PaymentMethod, Account['type']> = {
  cash: 'cash',
  credit: 'credit',
  emoney: 'emoney',
};

/**
 * 支払い方法から払った口座を決める。設定で選んだ口座 → その種類の最初の口座 → 既定の口座 の順。
 * 支払い方法がわからないときは現金扱い。
 */
export function accountForPayment(
  method: PaymentMethod | null,
  accounts: Pick<Account, 'id' | 'type' | 'archived'>[],
  settings: Pick<AppSettings, 'paymentAccountIds' | 'defaultAccountId'>,
): string | null {
  const active = accounts.filter((a) => !a.archived);
  const m = method ?? 'cash';
  const chosen = settings.paymentAccountIds[m];
  if (chosen && active.some((a) => a.id === chosen)) return chosen;
  const byType = active.find((a) => a.type === ACCOUNT_TYPE_FOR_PAYMENT[m]);
  if (byType) return byType.id;
  return active.some((a) => a.id === settings.defaultAccountId) ? settings.defaultAccountId : null;
}

export interface ReceiptReading {
  input: TransactionInput;
  method: PaymentMethod | null;
  reasons: ReviewReason[];
}

/** 読み取った文字から、記録する支出と、確認が必要かどうかを作る */
export function readingFromText(
  text: string,
  todayDate: string,
  data: {
    categories: Pick<Category, 'id' | 'kind'>[];
    accounts: Pick<Account, 'id' | 'type' | 'archived'>[];
    settings: Pick<AppSettings, 'paymentAccountIds' | 'defaultAccountId'>;
    transactions: Pick<Transaction, 'kind' | 'date' | 'amount'>[];
  },
): ReceiptReading {
  const fields = parseReceipt(text, todayDate);
  const method = findPaymentMethod(text);
  const fallbackCategory = data.categories.find((c) => c.id === 'other-expense' && c.kind === 'expense')?.id ?? null;
  return {
    input: {
      kind: 'expense',
      amount: fields.amount ?? 0,
      categoryId: guessCategoryId(text, data.categories) ?? fallbackCategory,
      accountId: accountForPayment(method, data.accounts, data.settings),
      toAccountId: null,
      date: fields.date ?? todayDate,
      memo: fields.storeName ?? '',
    },
    method,
    reasons: reviewReasons(fields, data.transactions),
  };
}
