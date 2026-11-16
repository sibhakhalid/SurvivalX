import type { HudSnapshot, WeaponSlotHud } from "../game/engine";
import { cn } from "../utils/cn";

function CrosshairIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.9" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="#7a5210" strokeWidth="1.6" />
      <rect x="10.6" y="7" width="2.8" height="10" rx="1" fill="#8a6014" />
    </svg>
  );
}

function WavePanel({ hud }: { hud: HudSnapshot }) {
  const inIntermission = hud.intermission > 0;
  const shown = inIntermission ? hud.nextWave : hud.wave;
  return (
    <div className="panel pointer-events-none absolute left-4 top-4 min-w-[168px] px-4 py-3">
      <div className="text-[10px] font-semibold tracking-[0.35em] text-[#9dff3d]/70">
        WAVE
      </div>
      <div className="flex items-end gap-3">
        <div className="font-display text-5xl leading-none text-[#eaffdc]">
          {String(Math.max(1, shown)).padStart(2, "0")}
        </div>
        <div className="pb-1">
          {inIntermission ? (
            <div className="blink font-display text-sm text-[#ffb02e]">
              T-{Math.max(1, Math.ceil(hud.intermission))}
            </div>
          ) : (
            <div className="font-display text-sm text-[#ff5964]">
              {hud.enemiesLeft} LEFT
            </div>
          )}
        </div>
      </div>
      <div className="mt-1.5 h-1 w-full bg-[#9dff3d]/15">
        <div
          className={cn(
            "h-full transition-[width] duration-300",
            inIntermission ? "bg-[#ffb02e]" : "bg-[#9dff3d]",
          )}
          style={{
            width: inIntermission
              ? `${(1 - hud.intermission / 3.4) * 100}%`
              : "100%",
          }}
        />
      </div>
    </div>
  );
}

function ScorePanel({ hud }: { hud: HudSnapshot }) {
  return (
    <div className="panel pointer-events-none absolute right-4 top-4 min-w-[210px] px-4 py-3 text-right">
      <div className="text-[10px] font-semibold tracking-[0.35em] text-[#9dff3d]/70">
        SCORE
      </div>
      <div className="font-display text-4xl leading-none text-[#eaffdc]">
        {String(hud.score).padStart(6, "0")}
      </div>
      <div className="mt-2 flex items-center justify-end gap-4 text-sm font-semibold">
        <span className="flex items-center gap-1.5 text-[#ff8a94]">
          <CrosshairIcon className="h-4 w-4" />
          {hud.kills}
        </span>
        <span className="flex items-center gap-1.5 text-[#ffcf4d]">
          <CoinIcon className="h-4 w-4" />
          {hud.coins}
        </span>
        <span className="text-[10px] tracking-widest text-white/35">
          BEST {String(hud.best).padStart(6, "0")}
        </span>
      </div>
    </div>
  );
}

function HpBar({ hud }: { hud: HudSnapshot }) {
  const pct = hud.hp / hud.maxHp;
  const color = pct > 0.5 ? "#9dff3d" : pct > 0.25 ? "#ffb02e" : "#ff5964";
  return (
    <div className="panel pointer-events-none px-4 py-3">
      <div className="flex items-center justify-between gap-6">
        <span className="text-[10px] font-semibold tracking-[0.35em] text-[#9dff3d]/70">
          INTEGRITY
        </span>
        <span
          className={cn(
            "font-display text-lg leading-none",
            pct > 0.25 ? "text-[#eaffdc]" : "blink text-[#ff5964]",
          )}
        >
          {hud.hp}
          <span className="text-xs text-white/40"> / {hud.maxHp}</span>
        </span>
      </div>
      <div className="relative mt-2 h-3.5 w-[260px] max-w-[38vw] border border-white/15 bg-[#08120d]">
        <div
          className="h-full transition-[width] duration-200"
          style={{
            width: `${Math.max(0, pct * 100)}%`,
            background: `linear-gradient(180deg, ${color}, ${color}88)`,
            boxShadow: `0 0 12px ${color}66`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent 0 11px, rgba(4,10,8,0.8) 11px 13px)",
          }}
        />
      </div>
    </div>
  );
}

function WeaponSlot({ slot, active }: { slot: WeaponSlotHud; active: boolean }) {
  const empty = slot.mag === 0;
  return (
    <div
      className={cn(
        "pointer-events-none relative min-w-[104px] border px-3 pb-2.5 pt-1.5 transition-all duration-150",
        active
          ? "-translate-y-1 border-[#9dff3d]/80 bg-[#12251a]/95 shadow-[0_0_18px_rgba(157,255,61,0.25)]"
          : "border-white/12 bg-[#0a1510]/85 opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="kbd">{slot.hotkey}</span>
        <span
          className={cn(
            "text-[10px] font-bold tracking-[0.22em]",
            active ? "text-[#9dff3d]" : "text-white/45",
          )}
        >
          {slot.tag}
        </span>
      </div>
      <div className="mt-1 font-display text-xl leading-none">
        <span className={cn(empty ? "text-[#ff5964]" : "text-[#eaffdc]")}>
          {slot.mag}
        </span>
        <span className="text-xs text-white/40"> / {slot.magSize}</span>
      </div>
      <div className="mt-0.5 text-[10px] font-semibold tracking-wider text-white/40">
        RESERVE {slot.reserve}
      </div>
      {slot.reloading && (
        <>
          <div className="blink absolute inset-x-0 bottom-0.5 text-center text-[9px] font-bold tracking-[0.3em] text-[#ffb02e]">
            RELOADING
          </div>
          <div className="absolute inset-x-0 top-0 h-0.5 bg-black/60">
            <div
              className="h-full bg-[#ffb02e]"
              style={{ width: `${slot.reloadProgress * 100}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function HUD({ hud }: { hud: HudSnapshot }) {
  const showBanner = hud.state === "playing" && hud.intermission > 0;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-body">
      <WavePanel hud={hud} />
      <ScorePanel hud={hud} />

      {/* wave banner */}
      {showBanner && (
        <div className="absolute inset-x-0 top-[22%] flex flex-col items-center">
          <div
            key={`banner-${hud.nextWave}`}
            className="banner-anim text-center"
          >
            <div className="text-xs font-bold tracking-[0.5em] text-[#ffb02e]">
              {hud.wave > 0 ? "SECTOR CLEARED" : "COMBAT PROTOCOL ACTIVE"}
            </div>
            <div className="font-display text-7xl text-[#eaffdc] [text-shadow:0_0_30px_rgba(157,255,61,0.4),0_4px_0_rgba(0,0,0,0.6)]">
              WAVE {hud.nextWave}
            </div>
            <div className="mt-1 text-xs font-semibold tracking-[0.35em] text-white/50">
              HOSTILES INBOUND
            </div>
          </div>
        </div>
      )}

      {/* bottom bar */}
      <div className="absolute inset-x-0 bottom-4 flex items-end justify-between gap-4 px-4">
        <HpBar hud={hud} />

        <div className="flex items-end gap-2">
          {hud.slots.map((s) => (
            <WeaponSlot key={s.id} slot={s} active={s.id === hud.activeWeapon} />
          ))}
        </div>

        <div className="panel hidden px-4 py-3 text-[11px] font-semibold leading-6 text-white/55 lg:block">
          <div className="flex items-center gap-2">
            <span className="kbd">W</span>
            <span className="kbd">A</span>
            <span className="kbd">S</span>
            <span className="kbd">D</span>
            <span className="ml-1">MOVE</span>
            <span className="mx-2 text-white/20">|</span>
            <span className="kbd">LMB</span>
            <span>FIRE</span>
            <span className="mx-2 text-white/20">|</span>
            <span className="kbd">R</span>
            <span>RELOAD</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="kbd">1</span>
            <span className="kbd">2</span>
            <span className="kbd">3</span>
            <span>WEAPONS</span>
            <span className="mx-2 text-white/20">|</span>
            <span className="kbd">ESC</span>
            <span>PAUSE</span>
            <span className="mx-2 text-white/20">|</span>
            <span className="kbd">M</span>
            <span>{hud.muted ? "UNMUTE" : "MUTE"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
