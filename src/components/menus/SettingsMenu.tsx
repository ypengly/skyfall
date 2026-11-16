import { useGameStore } from '../../stores/gameStore';
import Button from '../ui/Button';
import Slider from '../ui/Slider';
import Toggle from '../ui/Toggle';
import type { CameraMode, Quality } from '../../types';

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-xs tracking-widest transition ${value === o.id ? 'bg-white text-slate-900' : 'border border-white/20 text-white/80 hover:bg-white/10'}`}>{o.label}</button>
      ))}
    </div>
  );
}

export default function SettingsMenu() {
  const s = useGameStore((st) => st.settings);
  const up = useGameStore((st) => st.updateSettings);
  const back = useGameStore((st) => st.returnScreen);
  const setScreen = useGameStore((st) => st.setScreen);
  const Section = ({ t }: { t: string }) => <h3 className="mb-1 mt-6 text-xs tracking-[0.4em] text-sky-glow">{t}</h3>;
  const paused = back === 'paused';

  return (
    <div className={`fade-in absolute inset-0 z-30 flex items-center justify-center p-6 ${paused ? 'bg-black/70' : 'bg-black/55'} backdrop-blur-sm`}>
      <div className="glass max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-8">
        <h2 className="text-2xl font-light tracking-[0.4em]">SETTINGS</h2>

        <Section t="AUDIO" />
        <Slider label="Master volume" value={s.master} onChange={(v) => up({ master: v })} />
        <Slider label="Music volume" value={s.music} onChange={(v) => up({ music: v })} />
        <Slider label="Sound effects" value={s.sfx} onChange={(v) => up({ sfx: v })} />

        <Section t="GRAPHICS" />
        <div className="flex items-center justify-between py-2 text-sm text-white/85">
          <span>Quality</span>
          <Seg<Quality> value={s.quality} onChange={(v) => up({ quality: v })}
            options={[{ id: 'low', label: 'LOW' }, { id: 'medium', label: 'MED' }, { id: 'high', label: 'HIGH' }, { id: 'ultra', label: 'ULTRA' }]} />
        </div>
        <Toggle label="Adaptive quality (lowers detail if FPS drops)" value={s.adaptive} onChange={(v) => up({ adaptive: v })} />
        <Toggle label="Show FPS" value={s.showFps} onChange={(v) => up({ showFps: v })} />

        <Section t="CAMERA" />
        <div className="flex items-center justify-between py-2 text-sm text-white/85">
          <span>Camera mode (C)</span>
          <Seg<CameraMode> value={s.camMode} onChange={(v) => up({ camMode: v })}
            options={[{ id: 'third', label: 'CHASE' }, { id: 'wide', label: 'WIDE' }, { id: 'first', label: 'FIRST' }]} />
        </div>
        <Slider label="Camera shake" value={s.shake} onChange={(v) => up({ shake: v })} />
        <Slider label="Camera lag" value={s.camLag} min={0.4} max={2} step={0.05} onChange={(v) => up({ camLag: v })} format={(v) => v.toFixed(2) + '×'} />
        <Toggle label="Speed FOV & vignette effects" value={s.fovEffects} onChange={(v) => up({ fovEffects: v })} />

        <Section t="CONTROLS" />
        <Slider label="Mouse sensitivity" value={s.mouseSens} min={0.2} max={3} step={0.05} onChange={(v) => up({ mouseSens: v })} format={(v) => v.toFixed(2) + '×'} />
        <Toggle label="Mouse steering (click game to capture)" value={s.mouseLook} onChange={(v) => up({ mouseLook: v })} />
        <Toggle label="Invert mouse Y" value={s.invertY} onChange={(v) => up({ invertY: v })} />

        <Section t="UNITS" />
        <Seg<'kmh' | 'mph'> value={s.units} onChange={(v) => up({ units: v })} options={[{ id: 'kmh', label: 'KM/H · M' }, { id: 'mph', label: 'MPH · FT' }]} />

        <div className="mt-8"><Button variant="primary" onClick={() => setScreen(back)}>Back</Button></div>
      </div>
    </div>
  );
}
