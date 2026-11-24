import type { Account, AccountRole, AppSettings, Category, Goal, RecurringItem, Transaction, TransactionInput } from '@/types';
import { today } from '@/lib/date';
import { payeeKey, type Statement } from '@/lib/statements';
import { importStatement as importRows, type AccountMap, type ImportResult } from './importStatement';
import * as state from './state';
import { update } from './store';

// 画面から呼ぶ書き込み操作。中身は state.ts の純粋関数で、保存は store.ts が行う

type WithOptionalId<T extends { id: string }> = Omit<T, 'id'> & { id?: string };

/** 画面から口座を保存する。残高を手で入れたら、その日を残高を確かめた日にする */
export function saveAccount(account: WithOptionalId<Account>) {
  update((d) => state.saveAccount(d, account, today()));
}

export function archiveAccount(id: string) {
  update((d) => state.archiveAccount(d, id));
}

export function saveCategory(category: WithOptionalId<Category>) {
  update((d) => state.saveCategory(d, category));
}

export function deleteCategory(id: string) {
  update((d) => state.deleteCategory(d, id));
}

/** 取引を保存する。明細から取り込んだもののカテゴリを直したら、その振込先のカテゴリとして覚える */
export function saveTransaction(before: Transaction | null, input: TransactionInput) {
  update((d) => {
    const next = state.saveTransaction(d, before, input);
    const changed = before?.importKeys?.length && input.categoryId && input.categoryId !== before.categoryId;
    if (!changed || input.kind === 'transfer' || !input.memo) return next;
    return state.learnPayeeCategory(next, payeeKey(input.kind, before.memo || input.memo), input.categoryId!);
  });
}

/** 新しい取引を保存して、その ID を返す */
export function addTransaction(input: TransactionInput): string {
  const id = state.newId();
  update((d) => state.saveTransaction(d, null, input, Date.now(), id));
  return id;
}

export function deleteTransaction(tx: Transaction) {
  update((d) => state.deleteTransaction(d, tx));
}

export function saveBudget(categoryId: string | null, monthlyAmount: number) {
  update((d) => state.saveBudget(d, categoryId, monthlyAmount));
}

export function deleteBudget(id: string) {
  update((d) => state.deleteBudget(d, id));
}

export function saveGoal(goal: WithOptionalId<Goal>) {
  update((d) => state.saveGoal(d, goal));
}

export function deleteGoal(id: string) {
  update((d) => state.deleteGoal(d, id));
}

export function updateSettings(patch: Partial<AppSettings>) {
  update((d) => state.updateSettings(d, patch));
}

export function saveTransactions(inputs: TransactionInput[]) {
  update((d) => state.saveTransactions(d, inputs));
}

export function reconcileBalances(actuals: Record<string, number>, date: string) {
  update((d) => state.reconcileBalances(d, actuals, date));
}

export function saveRecurring(item: WithOptionalId<RecurringItem>) {
  update((d) => state.saveRecurring(d, item));
}

export function deleteRecurring(id: string) {
  update((d) => state.deleteRecurring(d, id));
}

export function postDueRecurring(today: string) {
  update((d) => state.postDueRecurring(d, today));
}

/** 明細の取り込みで、口座を既存のものにするか新しく作るか */
export type AccountChoice =
  | { accountId: string }
  /** as を付けると、その明細の種類の口座としても覚える（「自分の別の銀行口座」を SBI として作るなど） */
  | { create: Pick<Account, 'name' | 'type'>; as?: AccountRole };

/**
 * 明細を取り込む。必要なら口座を作り、明細の種類と口座の対応を覚えておく（次回から自動で選ばれる）。
 */
export function importStatement(
  statement: Statement,
  choices: Partial<Record<keyof AccountMap, AccountChoice>>,
  /** ことら・振込の相手ごとに、自分かどうか */
  people: Record<string, 'self' | 'other'> = {},
): ImportResult {
  let result: ImportResult = { added: 0, matched: 0, skipped: 0, unresolved: 0 };
  update((d) => {
    let next = d;
    const map: AccountMap = {};
    for (const [key, choice] of Object.entries(choices) as [keyof AccountMap, AccountChoice][]) {
      // 同じ画面で先に取り込んだ別の明細が、もうこの口座を作っていることがある
      const role = 'create' in choice && choice.as ? choice.as : key;
      const already = role === 'cash' ? undefined : next.settings.statementAccountIds[role];
      if ('accountId' in choice) {
        map[key] = choice.accountId;
      } else if (already && next.accounts.some((a) => a.id === already && !a.archived)) {
        map[key] = already;
      } else {
        const id = state.newId();
        next = state.saveAccount(next, {
          id,
          ...choice.create,
          balance: 0,
          sortOrder: next.accounts.length,
          archived: false,
        });
        map[key] = id;
        if (role !== key && role !== 'cash') {
          next = state.updateSettings(next, {
            statementAccountIds: { ...next.settings.statementAccountIds, [role]: id },
          });
        }
      }
    }
    const { cash: _cash, ...sources } = map;
    const others = new Set(next.settings.otherPeople);
    for (const [name, who] of Object.entries(people)) {
      if (who === 'other') others.add(name);
      else others.delete(name);
    }
    next = state.updateSettings(next, {
      statementAccountIds: { ...next.settings.statementAccountIds, ...sources },
      otherPeople: [...others],
    });
    const imported = importRows(next, statement, map, Date.now(), next.settings.otherPeople);
    result = imported.result;
    return imported.data;
  });
  return result;
}
