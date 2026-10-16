/** 日付は端末のローカル時刻で "YYYY-MM-DD"、月は "YYYY-MM" の文字列で扱う */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toDateString(new Date());
}

export function addDays(value: string, days: number): string {
  const date = fromDateString(value);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export function monthOf(value: string): string {
  return value.slice(0, 7);
}

export function currentMonth(): string {
  return monthOf(today());
}

export function addMonths(month: string, months: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + months, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** その月の取引を date >= start && date < end で絞り込むための範囲 */
export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${addMonths(month, 1)}-01` };
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y}年${m}月`;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function formatDate(value: string): string {
  const date = fromDateString(value);
  return `${date.getMonth() + 1}月${date.getDate()}日(${WEEKDAYS[date.getDay()]})`;
}

/** from から to まで残り何か月か（同じ月なら 1、過ぎていれば 0） */
export function monthsUntil(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm) + 1);
}
