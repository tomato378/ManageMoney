import type { Account, AccountRole, AccountType, AppSettings, StatementSource } from '@/types';

/**
 * カード会社・銀行・PayPay の明細CSVを読む。
 * 形式ごとに見分けて、行を「支出・収入・口座間の移動」に分ける。ポイントの動きなどお金でない行は捨てる。
 */

/**
 * 移動の相手。
 * - cash: 財布（ATM の出し入れ）
 * - self-bank: 自分の別の銀行口座（ことら送金・自分あての振込）
 * - savings: 定期預金
 */
export type Counterpart = AccountRole;

export interface StatementRow {
  /** YYYY-MM-DD */
  date: string;
  /** 円（正の整数） */
  amount: number;
  /**
   * expense: この口座から出た支払い
   * income: この口座に入ったお金
   * transfer-out / transfer-in: 自分の別の口座（counterpart）との移動
   */
  kind: 'expense' | 'income' | 'transfer-out' | 'transfer-in';
  /** 店名・取引の内容（全角・半角をそろえたもの） */
  name: string;
  counterpart?: Counterpart;
  /**
   * 送金の相手の名前（ことら・振込）。自分の名前なら口座間の移動、
   * ほかの人なら支出・入金として取り込む（取り込むときに選ぶ）
   */
  person?: string;
  /** 決まっているカテゴリ（割り勘・手数料など）。なければ店名から推測する */
  categoryId?: string;
  /**
   * この行がどの口座の明細か。PayPay の明細にはPayPayカード払いの行も混ざるので、行ごとに持つ。
   * 省略時はファイル全体の source。
   */
  source?: StatementSource;
  /** 同じ行を二重に取り込まないための目印（同じファイルを何度読んでも同じになる） */
  key: string;
}

export interface Statement {
  source: StatementSource;
  rows: StatementRow[];
  /** 明細に書かれた合計（請求額）。行の合計と照らし合わせて読み漏れを確かめる */
  total?: number;
  /** 明細の最後の時点の口座残高（銀行の明細） */
  balance?: number;
  /** 最後の行の日付（残高がいつ時点のものか） */
  lastDate?: string;
}

export const STATEMENT_LABELS: Record<StatementSource, string> = {
  saison: 'セゾンカード',
  'olive-credit': 'Olive クレジット',
  smbc: '三井住友銀行',
  paypay: 'PayPay',
  'paypay-card': 'PayPayカード',
  sbi: 'SBI新生銀行',
};

export const COUNTERPART_LABELS: Record<Counterpart, string> = {
  ...STATEMENT_LABELS,
  cash: '財布（ATMの出し入れ）',
  'self-bank': '自分の別の銀行口座（ことら・振込）',
  savings: '定期預金',
};

/**
 * CSV ファイルの中身を文字列にする。UTF-8 でなければ Shift_JIS として読む（カード会社・銀行の明細はたいていこちら）。
 * Decoder はテストで差し替える用
 */
export function decodeCsv(bytes: ArrayBuffer | Uint8Array, Decoder: typeof TextDecoder = TextDecoder): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text: string;
  try {
    text = new Decoder('utf-8', { fatal: true }).decode(view);
  } catch {
    text = new Decoder('shift_jis').decode(view);
  }
  return text.replace(/^﻿/, '');
}

/** ダブルクォートで囲まれた欄（中のカンマ・改行を含む）に対応した CSV の分解 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** 全角英数・半角カナをそろえ、長音などの揺れを直す */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/[―－‐ｰ]/g, 'ー')
    // カード会社の表記は長音を「-」で書く（ドト-ルコ-ヒ-）
    .replace(/(?<=[ァ-ヶ])-/g, 'ー')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "2026/9/5" や "2026/09/05 12:34:56" → "2026-09-05" */
function toDate(value: string): string | null {
  const m = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/** "1,130" や "-" → 円 */
function toAmount(value: string | undefined): number | null {
  if (!value) return null;
  const digits = value.normalize('NFKC').replace(/[,円\s]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits);
  return n > 0 ? n : null;
}

/** 同じ日・同じ金額・同じ店の行を見分けるため、何回目かを数えて key にする */
function keyMaker(prefix: string) {
  const seen = new Map<string, number>();
  return (...parts: (string | number)[]) => {
    const base = `${prefix}:${parts.join(':')}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}:${n}`;
  };
}

// ---- 形式ごとの読み方 ----

/** セゾン：「カード名称,…」の数行のあと「利用日,ご利用店名及び商品名,…,利用金額,備考」 */
function parseSaison(rows: string[][]): Statement {
  const total = toAmount(rows.find((r) => r[0] === '今回ご請求額')?.[1]);
  const header = rows.findIndex((r) => r[0] === '利用日');
  const key = keyMaker('saison');
  const out: StatementRow[] = [];
  for (const r of rows.slice(header + 1)) {
    const date = toDate(r[0]);
    const amount = toAmount(r[5]);
    // 海外利用の「(SAN FRANCISCO)」のような補足行は日付がない
    if (!date || !amount) continue;
    const name = normalizeName(r[1]);
    out.push({ date, amount, kind: 'expense', name, key: key(date, amount, name) });
  }
  return { source: 'saison', rows: out, total: total ?? undefined };
}

/** Olive クレジット：1行目が「名前,カード番号,Ｏｌｉｖｅ／クレジット」、最後の行が合計 */
function parseOliveCredit(rows: string[][]): Statement {
  const key = keyMaker('olive-credit');
  const out: StatementRow[] = [];
  let total: number | undefined;
  for (const r of rows.slice(1)) {
    const date = toDate(r[0]);
    if (!date) {
      total = toAmount(r[5]) ?? total;
      continue;
    }
    const amount = toAmount(r[5]) ?? toAmount(r[2]);
    if (!amount) continue;
    const name = normalizeName(r[1]);
    out.push({ date, amount, kind: 'expense', name, key: key(date, amount, name) });
  }
  return { source: 'olive-credit', rows: out, total };
}

/** 三井住友銀行：「年月日,お引出し,お預入れ,お取り扱い内容,残高,メモ,ラベル」。新しい順 */
function parseSmbc(rows: string[][]): Statement {
  const out: StatementRow[] = [];
  let balance: number | undefined;
  let lastDate: string | undefined;
  for (const r of rows.slice(1)) {
    const date = toDate(r[0]);
    if (!date) continue;
    const out1 = toAmount(r[1]);
    const amount = out1 ?? toAmount(r[2]);
    if (!amount) continue;
    const raw = normalizeName(r[3]);
    const rest = r[4]?.replace(/[,\s]/g, '') ?? '';
    // 新しい順に並んでいるので、いちばん新しい日の最初の行の残高が最後の残高
    if (/^-?\d+$/.test(rest) && (!lastDate || date > lastDate)) {
      lastDate = date;
      balance = Number(rest);
    }
    // 残高が行ごとに違うので、同じ日・同じ金額の行も残高で見分けられる
    const key = `smbc:${date}:${amount}:${out1 ? 'out' : 'in'}:${raw}:${rest}`;
    out.push({ ...classifySmbc(raw, !!out1), date, amount, key });
  }
  return { source: 'smbc', rows: out, balance, lastDate };
}

type Classified = Pick<StatementRow, 'kind' | 'name' | 'counterpart' | 'categoryId' | 'person'>;

function classifySmbc(raw: string, isOut: boolean): Classified {
  // デビット（iD）：「V123456 店名/iD」。店名がない行もある
  const debit = raw.match(/^V\d+\s*(.*)$/);
  if (debit) {
    const name = debit[1].replace(/\/\s*iD$/i, '').trim();
    return { kind: isOut ? 'expense' : 'income', name: name || 'デビット払い' };
  }
  if (/^カード手数料/.test(raw)) return { kind: 'expense', name: 'ATM手数料', categoryId: 'fee' };
  // ATM：引き出しは「カード ｾﾌﾞﾝ…」、入金は「CT 名前」
  if (isOut && /^カード\s/.test(raw)) return { kind: 'transfer-out', name: 'ATMで引き出し', counterpart: 'cash' };
  // 「CT 名前」はことら・振込での入金。自分からなら別の銀行口座からの移動
  const ct = raw.match(/^CT\s+(.+)$/);
  if (!isOut && ct) {
    return { kind: 'transfer-in', name: `${ct[1]}から入金`, counterpart: 'self-bank', person: ct[1].trim() };
  }
  if (isOut && /^ミツイスミトモカ-?ー?ド/.test(raw.replace(/\s/g, ''))) {
    return { kind: 'transfer-out', name: 'Olive クレジットの引き落とし', counterpart: 'olive-credit' };
  }
  return { kind: isOut ? 'expense' : 'income', name: raw };
}

/**
 * PayPay：「取引日,出金金額（円）,入金金額（円）,…,取引内容,取引先,取引方法,…,取引番号」。
 * PayPayカード払いの行は PayPayカードの支出として扱う（PayPayカードの明細と照合して二重にしない）。
 */
function parsePaypay(rows: string[][]): Statement {
  const header = rows[0];
  const col = (name: string) => header.findIndex((h) => h.includes(name));
  const [cDate, cOut, cIn, cType, cWho, cMethod, cNo] = [
    col('取引日'),
    col('出金金額'),
    col('入金金額'),
    col('取引内容'),
    col('取引先'),
    col('取引方法'),
    col('取引番号'),
  ];
  const out: StatementRow[] = [];
  // 表示名にもともと「さん」が付いている人もいる
  const person = (who: string) => (/(さん|様|さま)$/.test(who) ? who : `${who}さん`);
  for (const r of rows.slice(1)) {
    const date = toDate(r[cDate] ?? '');
    const outAmount = toAmount(r[cOut]);
    const inAmount = toAmount(r[cIn]);
    const amount = outAmount ?? inAmount;
    if (!date || !amount) continue;
    const type = r[cType]?.trim() ?? '';
    const who = normalizeName(r[cWho] ?? '');
    const method = normalizeName(r[cMethod] ?? '');
    // ポイントの運用・獲得はお金ではないので記録しない
    if (method.includes('ポイント')) continue;
    const key = `paypay:${r[cNo]?.trim() || `${date}:${amount}:${who}`}:${outAmount ? 'out' : 'in'}`;
    const byCard = /クレジット/.test(method);
    const source: StatementSource = byCard ? 'paypay-card' : 'paypay';
    if (type === '支払い' && who === 'PayPayカード請求') {
      out.push({ date, amount, key, kind: 'transfer-out', name: 'PayPayカードの支払い', counterpart: 'paypay-card' });
    } else if (type === '支払い' && outAmount) {
      out.push({ date, amount, key, kind: 'expense', name: who, source });
    } else if (type === '送った金額' && outAmount) {
      out.push({ date, amount, key, kind: 'expense', name: `${person(who)}に送金`, categoryId: 'split', source });
    } else if (type === '受け取った金額' && inAmount) {
      out.push({ date, amount, key, kind: 'income', name: `${person(who)}から受け取り`, categoryId: 'split' });
    } else if (type === 'チャージ' && inAmount) {
      const from: Counterpart | undefined = /SBI/i.test(method) ? 'sbi' : /三井住友|SMBC/.test(method) ? 'smbc' : undefined;
      out.push(
        from
          ? { date, amount, key, kind: 'transfer-in', name: `${method}からチャージ`, counterpart: from }
          : { date, amount, key, kind: 'income', name: `${method || 'チャージ'}` },
      );
    } else if (outAmount) {
      out.push({ date, amount, key, kind: 'expense', name: who || type, source });
    } else {
      out.push({ date, amount, key, kind: 'income', name: who || type });
    }
  }
  return { source: 'paypay', rows: out };
}

/** SBI新生銀行：「"取引日","摘要","出金金額","入金金額","残高","メモ"」。新しい順 */
function parseSbi(rows: string[][]): Statement {
  const out: StatementRow[] = [];
  let balance: number | undefined;
  let lastDate: string | undefined;
  for (const r of rows.slice(1)) {
    const date = toDate(r[0]);
    if (!date) continue;
    const out1 = toAmount(r[2]);
    const amount = out1 ?? toAmount(r[3]);
    if (!amount) continue;
    const raw = normalizeName(r[1]);
    const rest = r[4]?.replace(/[,\s]/g, '') ?? '';
    if (/^-?\d+$/.test(rest) && (!lastDate || date > lastDate)) {
      lastDate = date;
      balance = Number(rest);
    }
    const key = `sbi:${date}:${amount}:${out1 ? 'out' : 'in'}:${raw}:${rest}`;
    out.push({ ...classifySbi(raw, !!out1), date, amount, key });
  }
  return { source: 'sbi', rows: out, balance, lastDate };
}

function classifySbi(raw: string, isOut: boolean): Classified {
  const io = (kind: 'out' | 'in') => (kind === 'out' ? 'transfer-out' : 'transfer-in');
  const dir = isOut ? 'out' : 'in';
  const kotora = raw.match(/^ことら\s*(.+)$/);
  if (kotora) {
    const person = kotora[1].trim();
    return { kind: io(dir), name: isOut ? `${person}へ送金（ことら）` : `${person}から入金（ことら）`, counterpart: 'self-bank', person };
  }
  // 振込手数料は引かれたあと同じ額が戻ることがある（無料回数の範囲内）
  if (/^振込手数料/.test(raw)) return { kind: isOut ? 'expense' : 'income', name: isOut ? '振込手数料' : '振込手数料の返金', categoryId: 'fee' };
  if (/^ATM/.test(raw)) return { kind: io(dir), name: isOut ? 'ATMで引き出し' : 'ATMで入金', counterpart: 'cash' };
  if (isOut && /^セゾン/.test(raw)) return { kind: 'transfer-out', name: 'セゾンカードの引き落とし', counterpart: 'saison' };
  if (/^PayPay/i.test(raw)) return { kind: io(dir), name: isOut ? 'PayPayにチャージ' : 'PayPayから出金', counterpart: 'paypay' };
  if (/定期/.test(raw)) return { kind: io(dir), name: isOut ? '定期預金に預け入れ' : '定期預金の満期・解約', counterpart: 'savings' };
  if (!isOut && /^給与/.test(raw)) return { kind: 'income', name: raw.replace(/^給与\s*/, '給与 '), categoryId: 'salary' };
  if (!isOut && /利息/.test(raw)) return { kind: 'income', name: '利息', categoryId: 'other-income' };
  if (isOut && /^(国税|地方税)$/.test(raw)) return { kind: 'expense', name: `利息の${raw}`, categoryId: 'fee' };
  return { kind: isOut ? 'expense' : 'income', name: raw };
}

/** 中身を見て形式を判別して読む。どれでもなければ null */
export function parseStatement(text: string): Statement | null {
  const rows = parseCsv(text);
  if (rows.length === 0) return null;
  const first = rows[0].map((f) => f.normalize('NFKC').trim());
  if (first[0] === 'カード名称' && rows.some((r) => r[0] === '利用日')) return parseSaison(rows);
  if (first.some((f) => /Olive/i.test(f))) return parseOliveCredit(rows);
  if (first[0] === '年月日' && first.includes('お引出し')) return parseSmbc(rows);
  if (first[0] === '取引日' && first.some((f) => f.includes('取引番号'))) return parsePaypay(rows);
  if (first[0] === '取引日' && first[1] === '摘要' && first.includes('残高')) return parseSbi(rows);
  return null;
}

/** 明細の合計と、読み取った行の合計が合っているか（合計が書かれていない明細は null） */
export function totalMatches(statement: Statement): boolean | null {
  if (statement.total === undefined) return null;
  const sum = statement.rows.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount, 0);
  return sum === statement.total;
}

/** この明細を取り込むのに口座を決める必要があるもの（明細そのもの・PayPayカード払い・移動の相手） */
export function neededAccounts(statement: Statement): Counterpart[] {
  const needed = new Set<Counterpart>([statement.source]);
  for (const r of statement.rows) {
    if (r.source) needed.add(r.source);
    if (r.counterpart) needed.add(r.counterpart);
  }
  return [...needed];
}

/** 口座がないときに新しく作る口座 */
export const NEW_ACCOUNT_FOR: Record<Counterpart, { name: string; type: AccountType }> = {
  cash: { name: '財布', type: 'cash' },
  'self-bank': { name: '別の銀行口座', type: 'bank' },
  savings: { name: '定期預金', type: 'deposit' },
  saison: { name: 'セゾンカード', type: 'credit' },
  'olive-credit': { name: 'Olive クレジット', type: 'credit' },
  smbc: { name: '三井住友銀行', type: 'bank' },
  paypay: { name: 'PayPay', type: 'emoney' },
  'paypay-card': { name: 'PayPayカード', type: 'credit' },
  sbi: { name: 'SBI新生銀行', type: 'bank' },
};

const NAME_HINTS: Record<Counterpart, RegExp> = {
  cash: /財布|現金/,
  'self-bank': /$^/,
  savings: /定期/,
  saison: /セゾン|SAISON/i,
  'olive-credit': /Olive|オリーブ/i,
  smbc: /三井住友|SMBC/i,
  paypay: /^(?!.*カード).*PayPay/i,
  'paypay-card': /PayPay\s*カード/i,
  sbi: /SBI|新生/i,
};

/**
 * 前に選んだ口座 → 名前から推測 → 財布なら現金の口座、の順で口座を選ぶ。見つからなければ null（新しく作る）。
 * Olive のクレジットと三井住友銀行のように名前が似る口座は、種類（クレカ・銀行）も見る。
 */
export function guessAccount(
  target: Counterpart,
  accounts: Pick<Account, 'id' | 'name' | 'type' | 'archived'>[],
  settings: Pick<AppSettings, 'statementAccountIds' | 'paymentAccountIds'>,
  /** 取り込む明細そのものの口座（「自分の別の銀行口座」にはこれ以外を選ぶ） */
  ownAccountId?: string | null,
): string | null {
  const active = accounts.filter((a) => !a.archived && a.id !== (target === 'self-bank' ? ownAccountId : undefined));
  const remembered = target === 'cash' ? settings.paymentAccountIds.cash : settings.statementAccountIds[target];
  if (remembered && active.some((a) => a.id === remembered)) return remembered;
  if (target === 'self-bank') return active.find((a) => a.type === 'bank')?.id ?? null;
  const type = NEW_ACCOUNT_FOR[target].type;
  const byName = active.find((a) => a.type === type && NAME_HINTS[target].test(a.name));
  if (byName) return byName.id;
  if (target === 'cash') return active.find((a) => a.type === 'cash')?.id ?? null;
  return null;
}

/**
 * 振込先・店の名前を、カテゴリを覚えるためのキーにする。
 * 「振込 」「QP/」などの前置きと、毎回変わる末尾の番号は外す（フロンテイア1475707 → フロンテイア）。
 */
export function payeeKey(kind: 'income' | 'expense', name: string): string {
  const payee = normalizeName(name)
    .replace(/^(振込|給与|QP\/|ID\/)\s*/i, '')
    .replace(/\s*\d{3,}$/, '')
    .trim();
  return `${kind}:${payee}`;
}
