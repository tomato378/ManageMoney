const formatter = new Intl.NumberFormat('ja-JP');

/** 1234 → "¥1,234"、-1234 → "-¥1,234" */
export function formatYen(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}¥${formatter.format(Math.abs(Math.round(amount)))}`;
}

/** "1,234" や "１２３４" などの入力を円の整数にする。数字がなければ null */
export function parseAmount(input: string, { allowNegative = false } = {}): number | null {
  const normalized = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[ー－−]/g, '-')
    .replace(/[^0-9-]/g, '');
  const negative = allowNegative && normalized.startsWith('-');
  const digits = normalized.replace(/-/g, '');
  if (digits === '') return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return negative ? -value : value;
}
