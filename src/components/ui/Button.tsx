import { ReactNode } from 'react';
import { getGame } from '../../game/core/Game';

interface Props {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost' | 'danger'; className?: string;
}

export default function Button({ children, onClick, disabled, variant = 'ghost', className = '' }: Props) {
  const base = 'rounded-lg px-6 py-3 text-sm font-medium tracking-[0.25em] uppercase transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-35';
  const look = variant === 'primary'
    ? 'bg-white text-slate-900 hover:bg-sky-glow hover:scale-[1.03]'
    : variant === 'danger'
      ? 'border border-red-400/40 text-red-200 hover:bg-red-500/20'
      : 'border border-white/20 text-white/90 hover:bg-white/10 hover:border-white/40';
  return (
    <button disabled={disabled} className={`${base} ${look} ${className}`}
      onClick={() => { getGame()?.audio.ensure(); getGame()?.audio.sfx('click'); onClick?.(); }}>
      {children}
    </button>
  );
}
