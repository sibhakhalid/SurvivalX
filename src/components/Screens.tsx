import type { ReactNode } from "react";
import type { HudSnapshot } from "../game/engine";
import { ENEMY_LIST, WEAPON_LIST } from "../game/types";
import { cn } from "../utils/cn";

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M6 3.8v16.4L20 12 6 3.8z" />
    </svg>
  );
}

function RetryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 3v4.5h-4.5" />
    </svg>
  );
}

function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function PrimaryBtn({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "clip-btn group relative inline-flex items-center justify-center gap-3 bg-[#9dff3d] px-10 py-4 font-display text-xl tracking-[0.18em] text-[#08130c] transition-all duration-150",
        "hover:bg-[#c0ff7a] hover:tracking-[0.26em] active:translate-y-0.5",
        className,
      )}
    >
      {children}
    </button>
  );
}

function GhostBtn({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="clip-btn border border-[#9dff3d]/40 bg-[#0c1a14]/80 px-8 py-4 font-display text-base tracking-[0.18em] text-[#9dff3d] transition-all duration-150 hover:border-[#9dff3d] hover:bg-[#12251a] active:translate-y-0.5"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Stat bar for the armory                                             */
/* ------------------------------------------------------------------ */
function Stat({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-7 text-[9px] font-bold tracking-widest text-white/40">
        {label}
      </span>
      <div className="h-1.5 w-16 bg-white/10">
        <div className="h-full bg-[#9dff3d]/80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function MenuScreen({
  best,
  onStart,
}: {
  best: number;
  onStart: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgba(7,13,11,0.72),rgba(4,8,6,0.94))] px-6 py-8">
      <div className="scanlines pointer-events-none absolute inset-0" />
      <div className="relative mx-auto w-full max-w-5xl">
        {/* header */}
        <div className="rise-in flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className="hazard-dim inline-block h-2.5 w-24" />
              <span className="text-xs font-bold tracking-[0.5em] text-[#9dff3d]">
                OPERATION FILE // X-01
              </span>
            </div>
            <h1 className="font-display leading-[0.85]">
              <span className="title-flicker block text-6xl text-[#eaffdc] md:text-7xl">
                SURVIVAL
              </span>
              <span className="block text-8xl text-[#ffb02e] [text-shadow:0_0_34px_rgba(255,176,46,0.45),0_5px_0_rgba(0,0,0,0.55)] md:text-9xl">
                X
              </span>
            </h1>
            <p className="mt-3 max-w-md text-sm font-medium text-white/60">
              The swarm owns the night. You own one arena, three guns, and
              whatever they drop. Outlast every wave.
            </p>
          </div>
          <div className="panel px-5 py-4 text-right">
            <div className="text-[10px] font-semibold tracking-[0.35em] text-[#9dff3d]/70">
              BEST SCORE
            </div>
            <div className="font-display text-4xl text-[#ffcf4d]">
              {String(best).padStart(6, "0")}
            </div>
            <div className="mt-1 text-[10px] tracking-[0.25em] text-white/40">
              BUILD 0.2 // COMBAT SYSTEMS ONLINE
            </div>
          </div>
        </div>

        {/* intel row */}
        <div className="mt-6 grid gap-4 md:grid-cols-[1.35fr_1fr]">
          <div className="panel rise-in px-5 py-4" style={{ animationDelay: "0.08s" }}>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.35em] text-[#9dff3d]">
              <span className="inline-block h-1.5 w-1.5 bg-[#9dff3d]" />
              ARMORY
            </div>
            <div className="space-y-3">
              {WEAPON_LIST.map((w) => (
                <div key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="kbd">{w.hotkey}</span>
                  <div className="w-36">
                    <div className="font-display text-sm tracking-wider text-[#eaffdc]">
                      {w.tag}
                    </div>
                    <div className="text-[10px] text-white/40">{w.name}</div>
                  </div>
                  <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                    <Stat label="DMG" pct={Math.min(100, ((w.damage * w.pellets) / 88) * 100)} />
                    <Stat label="RATE" pct={(w.fireRate / 11) * 100} />
                    <Stat label="RNG" pct={(w.range / 660) * 100} />
                    <Stat label="MAG" pct={(w.magSize / 32) * 100} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="panel rise-in flex-1 px-5 py-4" style={{ animationDelay: "0.16s" }}>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.35em] text-[#ff5964]">
                <span className="inline-block h-1.5 w-1.5 bg-[#ff5964]" />
                KNOWN THREATS
              </div>
              <div className="space-y-2.5">
                {ENEMY_LIST.map((e) => (
                  <div key={e.kind} className="flex items-start gap-3">
                    <span
                      className="mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{ background: e.color, boxShadow: `0 0 10px ${e.color}88` }}
                    />
                    <div>
                      <span className="font-display text-sm tracking-wider text-[#eaffdc]">
                        {e.name}
                      </span>
                      <span className="ml-2 text-[10px] text-white/40">
                        HP {e.hp} · DMG {e.damage} · {e.score} PTS
                      </span>
                      <div className="text-[11px] text-white/50">{e.blurb}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel rise-in px-5 py-3" style={{ animationDelay: "0.24s" }}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold text-white/55">
                <span className="kbd">W</span>
                <span className="kbd">A</span>
                <span className="kbd">S</span>
                <span className="kbd">D</span>
                <span>MOVE</span>
                <span className="kbd">MOUSE</span>
                <span>AIM</span>
                <span className="kbd">LMB</span>
                <span>FIRE</span>
                <span className="kbd">R</span>
                <span>RELOAD</span>
                <span className="kbd">1-3</span>
                <span>SWAP</span>
                <span className="kbd">ESC</span>
                <span>PAUSE</span>
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="rise-in mt-7 flex flex-wrap items-center gap-5" style={{ animationDelay: "0.3s" }}>
          <PrimaryBtn onClick={onStart} className="deploy-pulse">
            <PlayIcon className="h-5 w-5" />
            DEPLOY
          </PrimaryBtn>
          <div className="text-xs font-semibold tracking-[0.2em] text-white/45">
            PRESS <span className="kbd mx-1">ENTER</span> TO DEPLOY
            <span className="mx-2 text-white/20">|</span>
            <span className="kbd mx-1">M</span> SOUND ON/OFF
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function PauseScreen({
  onResume,
  onQuit,
}: {
  onResume: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#040806]/78 backdrop-blur-[2px]">
      <div className="scanlines pointer-events-none absolute inset-0" />
      <div className="panel rise-in relative mx-4 w-full max-w-md px-8 py-8 text-center">
        <div className="hazard-dim mx-auto mb-4 h-2 w-28" />
        <h2 className="font-display text-5xl tracking-wide text-[#eaffdc]">PAUSED</h2>
        <p className="mt-2 text-xs font-semibold tracking-[0.4em] text-[#ffb02e]">
          OPERATION SUSPENDED
        </p>
        <p className="mt-4 text-sm text-white/55">
          The swarm holds its breath. It will not wait long.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <PrimaryBtn onClick={onResume} className="w-64 text-center">
            RESUME
          </PrimaryBtn>
          <GhostBtn onClick={onQuit}>ABORT TO MENU</GhostBtn>
        </div>
        <div className="mt-5 text-[11px] font-semibold tracking-[0.2em] text-white/40">
          <span className="kbd mx-1">ESC</span> RESUME
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function GameOverScreen({
  hud,
  onRestart,
  onMenu,
}: {
  hud: HudSnapshot;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const stats: { label: string; value: string; accent?: string }[] = [
    { label: "WAVES SURVIVED", value: String(hud.wave) },
    { label: "KILLS", value: String(hud.kills), accent: "#ff8a94" },
    { label: "COINS", value: String(hud.coins), accent: "#ffcf4d" },
    { label: "ACCURACY", value: `${Math.round(hud.accuracy * 100)}%` },
    { label: "TIME ALIVE", value: fmtTime(hud.time) },
  ];
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(30,6,10,0.62),rgba(4,6,5,0.93))]">
      <div className="scanlines pointer-events-none absolute inset-0" />
      <div className="relative mx-4 w-full max-w-xl text-center">
        <div className="rise-in">
          <div className="text-xs font-bold tracking-[0.5em] text-[#ff5964]">
            OPERATIVE DOWN
          </div>
          <h2 className="font-display mt-2 text-7xl text-[#ff5964] [text-shadow:0_0_40px_rgba(255,89,100,0.5),0_5px_0_rgba(0,0,0,0.6)]">
            SIGNAL LOST
          </h2>
          {hud.newBest ? (
            <div className="blink mt-3 inline-block border border-[#ffcf4d]/70 bg-[#ffcf4d]/10 px-4 py-1 font-display text-sm tracking-[0.25em] text-[#ffcf4d]">
              ★ NEW RECORD ★
            </div>
          ) : (
            <div className="mt-3 text-xs font-semibold tracking-[0.3em] text-white/45">
              BEST {String(hud.best).padStart(6, "0")}
            </div>
          )}
        </div>

        <div className="panel rise-in mt-6 px-6 py-5" style={{ animationDelay: "0.1s" }}>
          <div className="text-[10px] font-semibold tracking-[0.35em] text-[#9dff3d]/70">
            FINAL SCORE
          </div>
          <div className="stat-pop font-display text-6xl text-[#eaffdc]">
            {String(hud.score).padStart(6, "0")}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="stat-pop border border-white/10 bg-black/25 px-2 py-2.5"
                style={{ animationDelay: `${0.15 + i * 0.07}s` }}
              >
                <div className="text-[9px] font-bold tracking-[0.25em] text-white/40">
                  {s.label}
                </div>
                <div
                  className="font-display text-2xl"
                  style={{ color: s.accent ?? "#eaffdc" }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rise-in mt-6 flex flex-wrap items-center justify-center gap-4" style={{ animationDelay: "0.2s" }}>
          <PrimaryBtn onClick={onRestart} className="deploy-pulse">
            <RetryIcon className="h-5 w-5" />
            REDEPLOY
          </PrimaryBtn>
          <GhostBtn onClick={onMenu}>MAIN MENU</GhostBtn>
        </div>
        <div className="mt-4 text-[11px] font-semibold tracking-[0.2em] text-white/40">
          PRESS <span className="kbd mx-1">ENTER</span> TO REDEPLOY
        </div>
      </div>
    </div>
  );
}
