import { daysBetween } from '@/lib/date';
import { guessCategoryId } from '@/lib/receipt';
import type { Counterpart, Statement, StatementRow } from '@/lib/statements';
import type { Transaction, TransactionInput } from '@/types';
import { newId, saveTransaction, type AppData } from './state';

/** 明細の種類（と財布）→ 口座ID */
export type AccountMap = Partial<Record<Counterpart, string>>;

export interface ImportResult {
  /** 新しく記録した行 */
  added: number;
  /** レシートや毎月の項目など、記録済みのものと照合した行 */
  matched: number;
  /** 前に取り込み済みだった行 */
  skipped: number;
  /** 口座が決まっていなくて取り込めなかった行 */
  unresolved: number;
}

/** レシートの日付と明細の日付（売上日・計上日）は数日ずれることがある */
const DATE_TOLERANCE = 3;
/** 毎月の項目（給料・家賃など）はだいたいの額で登録されているので、ずれを許す */
const RECURRING_DATE_TOLERANCE = 5;
const RECURRING_AMOUNT_TOLERANCE = 0.2;

/** key の最初の部分（どの明細ファイルから来たか）。同じ明細の別の行と照合しないために使う */
function prefixOf(key: string): string {
  return key.split(':')[0];
}

function fromSamePrefix(tx: Transaction, key: string): boolean {
  return (tx.importKeys ?? []).some((k) => prefixOf(k) === prefixOf(key));
}

function nearDate(a: string, b: string, days: number): boolean {
  return Math.abs(daysBetween(a, b)) <= days;
}

/**
 * 明細の1行と同じお金の動きが、すでに記録されていないか探す。
 * - レシートで記録した支出（どの口座でも）：金額が同じで日付が近い
 * - 同じ口座の支出（別の明細から取り込んだもの・手入力）：金額が同じで日付が近い
 * - 毎月の項目：金額が2割以内・日付が5日以内
 * - 振替：同じ2口座の間で金額が同じ（PayPay のチャージと銀行の引き出しなど）
 */
function findMatch(
  txs: Transaction[],
  row: StatementRow,
  accountId: string,
  counterpartId: string | null,
  used: Set<string>,
): Transaction | null {
  const candidates = txs.filter((tx) => {
    if (used.has(tx.id) || fromSamePrefix(tx, row.key)) return false;
    if (row.kind === 'transfer-out' || row.kind === 'transfer-in') {
      const [from, to] = row.kind === 'transfer-out' ? [accountId, counterpartId] : [counterpartId, accountId];
      return (
        tx.kind === 'transfer' &&
        tx.accountId === from &&
        tx.toAccountId === to &&
        tx.amount === row.amount &&
        nearDate(tx.date, row.date, DATE_TOLERANCE)
      );
    }
    if (tx.kind !== row.kind) return false;
    if (tx.origin === 'recurring') {
      return (
        tx.accountId === accountId &&
        Math.abs(tx.amount - row.amount) <= row.amount * RECURRING_AMOUNT_TOLERANCE &&
        nearDate(tx.date, row.date, RECURRING_DATE_TOLERANCE)
      );
    }
    if (tx.amount !== row.amount || !nearDate(tx.date, row.date, DATE_TOLERANCE)) return false;
    if (tx.origin === 'adjustment') return false;
    return tx.origin === 'receipt' || tx.accountId === accountId;
  });
  // 日付がいちばん近いものを選ぶ
  candidates.sort((a, b) => Math.abs(daysBetween(a.date, row.date)) - Math.abs(daysBetween(b.date, row.date)));
  return candidates[0] ?? null;
}

/**
 * 明細を取り込む。
 * - 同じ行を二度取り込まない（importKeys で判定）
 * - レシートなど記録済みのものと合えば、新しく足さずに払った口座と金額を明細に合わせる
 * - asOf（その口座の残高を最後に確かめた日）以前の行は、残高にはもう含まれているので残高を動かさない
 * - 残高つきの明細（銀行）は、最後に口座の残高を明細の残高に合わせる
 */
export function importStatement(
  data: AppData,
  statement: Statement,
  accounts: AccountMap,
  now = Date.now(),
): { data: AppData; result: ImportResult } {
  const result: ImportResult = { added: 0, matched: 0, skipped: 0, unresolved: 0 };
  const used = new Set<string>();
  let next = data;
  const confirmedAt = data.settings.confirmedAt;

  for (const row of statement.rows) {
    const accountId = accounts[row.source ?? statement.source];
    const isTransfer = row.kind === 'transfer-out' || row.kind === 'transfer-in';
    const counterpartId = row.counterpart ? (accounts[row.counterpart] ?? null) : null;
    if (!accountId || (isTransfer && !counterpartId)) {
      result.unresolved++;
      continue;
    }
    if (next.transactions.some((tx) => tx.importKeys?.includes(row.key))) {
      result.skipped++;
      continue;
    }

    const match = findMatch(next.transactions, row, accountId, counterpartId, used);
    if (match) {
      used.add(match.id);
      const input: TransactionInput = {
        ...match,
        amount: row.amount,
        accountId: isTransfer ? match.accountId : accountId,
        memo: match.memo || row.name,
        categoryId: match.categoryId ?? row.categoryId ?? null,
        importKeys: [...(match.importKeys ?? []), row.key],
      };
      next = saveTransaction(next, match, stripMeta(input), now);
      result.matched++;
      continue;
    }

    const input: TransactionInput = isTransfer
      ? {
          kind: 'transfer',
          amount: row.amount,
          categoryId: null,
          accountId: row.kind === 'transfer-out' ? accountId : counterpartId,
          toAccountId: row.kind === 'transfer-out' ? counterpartId : accountId,
          date: row.date,
          memo: row.name,
          origin: 'statement',
          importKeys: [row.key],
        }
      : {
          kind: row.kind === 'income' ? 'income' : 'expense',
          amount: row.amount,
          categoryId:
            row.categoryId ??
            (row.kind === 'expense' ? guessCategoryId(row.name, next.categories) : null) ??
            fallbackCategory(next, row.kind === 'income' ? 'income' : 'expense'),
          accountId,
          toAccountId: null,
          date: row.date,
          memo: row.name,
          origin: 'statement',
          importKeys: [row.key],
        };
    const before = next;
    next = saveTransaction(next, null, input, now, newId());
    // 残高を確かめた日より前の動きは、その残高にもう含まれている
    const settled = (id: string | null) => !!id && !!confirmedAt[id] && row.date <= confirmedAt[id];
    next = {
      ...next,
      accounts: next.accounts.map((a) => {
        const was = before.accounts.find((b) => b.id === a.id);
        return was && settled(a.id) ? { ...a, balance: was.balance } : a;
      }),
    };
    result.added++;
  }

  // 銀行の明細は残高が書いてあるので、それが正しい残高
  const own = accounts[statement.source];
  if (own && statement.balance !== undefined && statement.lastDate) {
    const lastDate = statement.lastDate;
    const prev = next.settings.confirmedAt[own];
    if (!prev || prev <= lastDate) {
      next = {
        ...next,
        accounts: next.accounts.map((a) => (a.id === own ? { ...a, balance: statement.balance! } : a)),
        settings: { ...next.settings, confirmedAt: { ...next.settings.confirmedAt, [own]: lastDate } },
      };
    }
  }
  return { data: next, result };
}

/** 照合で上書きするときに、取引の ID などを入力から外す */
function stripMeta(tx: TransactionInput & Partial<Pick<Transaction, 'id' | 'createdAt'>>): TransactionInput {
  const { id: _id, createdAt: _createdAt, ...input } = tx;
  return input;
}

function fallbackCategory(data: AppData, kind: 'income' | 'expense'): string | null {
  const id = kind === 'income' ? 'other-income' : 'other-expense';
  return data.categories.some((c) => c.id === id) ? id : (data.categories.find((c) => c.kind === kind)?.id ?? null);
}
