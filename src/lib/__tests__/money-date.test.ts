import { addDays, addMonths, formatDate, formatMonth, monthRange, monthsUntil } from '../date';
import { formatYen, parseAmount } from '../money';

describe('formatYen', () => {
  it('3桁区切りと円記号', () => {
    expect(formatYen(1234567)).toBe('¥1,234,567');
    expect(formatYen(0)).toBe('¥0');
    expect(formatYen(-30000)).toBe('-¥30,000');
  });
});

describe('parseAmount', () => {
  it('カンマや全角数字を受け付ける', () => {
    expect(parseAmount('1,234')).toBe(1234);
    expect(parseAmount('１２３４')).toBe(1234);
    expect(parseAmount('¥500')).toBe(500);
  });

  it('数字がなければ null', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('マイナスは許可したときだけ', () => {
    expect(parseAmount('-3000')).toBe(3000);
    expect(parseAmount('-3000', { allowNegative: true })).toBe(-3000);
    expect(parseAmount('ー3000', { allowNegative: true })).toBe(-3000);
  });
});

describe('date', () => {
  it('月の加減算は年をまたぐ', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('日の加減算は月をまたぐ', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('月の範囲', () => {
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });

  it('表示用の書式', () => {
    expect(formatMonth('2026-10')).toBe('2026年10月');
    expect(formatDate('2026-10-16')).toBe('10月16日(金)');
  });

  it('期日までの月数', () => {
    expect(monthsUntil('2026-10-16', '2026-10-31')).toBe(1);
    expect(monthsUntil('2026-10-16', '2027-03-01')).toBe(6);
    expect(monthsUntil('2026-10-16', '2026-09-30')).toBe(0);
  });
});
