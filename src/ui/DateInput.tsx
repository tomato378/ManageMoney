import { colors, radius } from './theme';

/** ブラウザ標準の日付ピッカー。value / onChange は "YYYY-MM-DD" */
export function DateInput({
  value,
  onChange,
  min,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  label: string;
}) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      aria-label={label}
      onChange={(event) => {
        if (event.target.value) onChange(event.target.value);
      }}
      style={{
        fontSize: 15,
        padding: '6px 10px',
        borderRadius: radius.sm,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        backgroundColor: colors.card,
        fontFamily: 'inherit',
      }}
    />
  );
}
