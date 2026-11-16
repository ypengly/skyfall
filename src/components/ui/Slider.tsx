interface Props { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }

export default function Slider({ label, value, min = 0, max = 1, step = 0.01, onChange, format }: Props) {
  return (
    <label className="flex items-center justify-between gap-6 py-2 text-sm text-white/85">
      <span className="w-44 shrink-0">{label}</span>
      <input type="range" className="flex-1" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span className="w-14 text-right tabular-nums text-white/60">{format ? format(value) : Math.round(value * 100) + '%'}</span>
    </label>
  );
}
