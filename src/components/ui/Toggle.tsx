interface Props { label: string; value: boolean; onChange: (v: boolean) => void }

export default function Toggle({ label, value, onChange }: Props) {
  return (
    <button className="flex w-full items-center justify-between py-2 text-sm text-white/85" onClick={() => onChange(!value)}>
      <span>{label}</span>
      <span className={`relative h-5 w-10 rounded-full transition-colors ${value ? 'bg-sky-glow' : 'bg-white/25'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
