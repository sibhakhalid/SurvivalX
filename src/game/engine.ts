import {
  AMMO_PACK,
  ENEMIES,
  PLAYER,
  START_RESERVE,
  WEAPON_LIST,
  WEAPONS,
  type EnemyKind,
  type GameState,
  type WeaponId,
} from "./types";
import { SFX } from "./audio";

/* ------------------------------------------------------------------ */
/* HUD snapshot shared with React                                      */
/* ------------------------------------------------------------------ */
export interface WeaponSlotHud {
  id: WeaponId;
  name: string;
  tag: string;
  hotkey: string;
  mag: number;
  magSize: number;
  reserve: number;
  reloading: boolean;
  reloadProgress: number;
}

export interface HudSnapshot {
  state: GameState;
  hp: number;
  maxHp: number;
  slots: WeaponSlotHud[];
  activeWeapon: WeaponId;
  score: number;
  kills: number;
  coins: number;
  wave: number; // wave in combat (0 before first)
  nextWave: number; // wave shown during intermission
  enemiesLeft: number;
  intermission: number; // seconds until next wave (0 during combat)
  muted: boolean;
  best: number;
  newBest: boolean;
  time: number;
  accuracy: number;
}

/* ------------------------------------------------------------------ */
/* Internal entity types                                               */
/* ------------------------------------------------------------------ */
interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  nx: number;
  ny: number;
  dmg: number;
  dist: number;
  maxDist: number;
  size: number;
  color: string;
  kb: number;
  dead: boolean;
}

interface Enemy {
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kbx: number;
  kby: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  state: "chase" | "windup" | "recover";
  t: number;
  cd: number;
  flash: number;
  seed: number;
  angle: number;
}

interface Marker {
  x: number;
  y: number;
  t: number;
  dur: number;
  kind: EnemyKind;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
  glow: boolean;
  shape: "dot" | "rect" | "ring";
  rot: number;
  vrot: number; // for rings: radius growth px/s; for rects: spin
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  life: number;
  size: number;
}

interface Pickup {
  kind: "coin" | "ammo";
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
}

interface AmbientDot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  seed: number;
}

/* ------------------------------------------------------------------ */
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const BEST_KEY = "survivalx_best_v1";

/* ------------------------------------------------------------------ */
export class Game {
  state: GameState = "menu";
  sfx = new SFX();
  onHud: ((h: HudSnapshot) => void) | null = null;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private floor: HTMLCanvasElement | null = null;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private pad = 30;

  /* input */
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false };

  /* player */
  private player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    hp: PLAYER.maxHp,
    aim: 0,
    bob: 0,
    moving: false,
    invuln: 0,
    muzzle: 0,
    kick: 0,
    dustT: 0,
  };
  private mags: Record<WeaponId, number> = { pistol: 0, smg: 0, shotgun: 0 };
  private reserve: Record<WeaponId, number> = { pistol: 0, smg: 0, shotgun: 0 };
  private weapon: WeaponId = "pistol";
  private fireCd = 0;
  private reloading = false;
  private reloadT = 0;
  private dryCd = 0;
  private hitSndCd = 0;

  /* entities */
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private pickups: Pickup[] = [];
  private markers: Marker[] = [];
  private queue: { kind: EnemyKind; t: number }[] = [];
  private spawnT = 0;

  /* waves */
  private wave = 0;
  private wavePhase: "intermission" | "combat" = "intermission";
  private intermission = 0;

  /* stats */
  private time = 0;
  private score = 0;
  private kills = 0;
  private coins = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private best = 0;
  private newBest = false;

  /* fx */
  private shakeT = 0;
  private shakeDur = 1;
  private shakeMag = 0;
  private hurtFlash = 0;
  private ambient: AmbientDot[] = [];

  private hudAcc = 0;
  private raf = 0;
  private last = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;

    try {
      this.best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
    } catch {
      this.best = 0;
    }

    this.resize();
    this.player.x = this.W / 2;
    this.player.y = this.H / 2;
    this.initAmbient();

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("contextmenu", this.onCtx);
    document.addEventListener("visibilitychange", this.onVis);

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("contextmenu", this.onCtx);
    document.removeEventListener("visibilitychange", this.onVis);
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                        */
  /* ---------------------------------------------------------------- */
  snapshot(): HudSnapshot {
    return {
      state: this.state,
      hp: Math.max(0, Math.ceil(this.player.hp)),
      maxHp: PLAYER.maxHp,
      slots: WEAPON_LIST.map((d) => ({
        id: d.id,
        name: d.name,
        tag: d.tag,
        hotkey: d.hotkey,
        mag: this.mags[d.id],
        magSize: d.magSize,
        reserve: this.reserve[d.id],
        reloading: this.weapon === d.id && this.reloading,
        reloadProgress:
          this.weapon === d.id && this.reloading
            ? clamp(this.reloadT / d.reloadTime, 0, 1)
            : 0,
      })),
      activeWeapon: this.weapon,
      score: this.score,
      kills: this.kills,
      coins: this.coins,
      wave: this.wave,
      nextWave: this.wave + 1,
      enemiesLeft: this.queue.length + this.markers.length + this.enemies.length,
      intermission: this.wavePhase === "intermission" ? this.intermission : 0,
      muted: this.sfx.muted,
      best: this.best,
      newBest: this.newBest,
      time: this.time,
      accuracy:
        this.shotsFired > 0 ? clamp(this.shotsHit / this.shotsFired, 0, 1) : 0,
    };
  }

  startGame() {
    this.sfx.ensure();
    this.reset();
    this.state = "playing";
    this.mouse.down = false;
    this.sfx.click();
    this.emit(true);
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.mouse.down = false;
    this.last = performance.now();
    this.sfx.click();
    this.emit(true);
  }

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.emit(true);
    } else if (this.state === "paused") {
      this.resume();
    }
  }

  toMenu() {
    this.state = "menu";
    this.bullets = [];
    this.enemies = [];
    this.markers = [];
    this.queue = [];
    this.pickups = [];
    this.sfx.click();
    this.emit(true);
  }

  toggleMute() {
    this.sfx.ensure();
    this.sfx.setMuted(!this.sfx.muted);
    this.emit(true);
  }

  /* ---------------------------------------------------------------- */
  /* Input handlers                                                    */
  /* ---------------------------------------------------------------- */
  private onCtx = (e: Event) => e.preventDefault();

  private onResize = () => this.resize();

  private onVis = () => {
    if (document.hidden && this.state === "playing") {
      this.state = "paused";
      this.emit(true);
    }
  };

  private onBlur = () => {
    this.keys.clear();
    this.mouse.down = false;
    if (this.state === "playing") {
      this.state = "paused";
      this.emit(true);
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (
      code.startsWith("Arrow") ||
      code === "Space" ||
      code === "Tab"
    ) {
      e.preventDefault();
    }
    this.keys.add(code);

    if (code === "Digit1" || code === "Numpad1") this.switchWeapon("pistol");
    else if (code === "Digit2" || code === "Numpad2") this.switchWeapon("smg");
    else if (code === "Digit3" || code === "Numpad3") this.switchWeapon("shotgun");
    else if (code === "KeyR") this.startReload();
    else if (code === "KeyM") this.toggleMute();
    else if (code === "Escape" || code === "KeyP") this.togglePause();
    else if (code === "Enter") {
      if (this.state === "menu" || this.state === "gameover") this.startGame();
      else if (this.state === "paused") this.resume();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.down = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.down = false;
  };

  /* ---------------------------------------------------------------- */
  /* Setup                                                             */
  /* ---------------------------------------------------------------- */
  private resize() {
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.buildFloor();
    // keep player inside after resize
    this.player.x = clamp(this.player.x, this.pad + PLAYER.radius, this.W - this.pad - PLAYER.radius);
    this.player.y = clamp(this.player.y, this.pad + PLAYER.radius, this.H - this.pad - PLAYER.radius);
  }

  private initAmbient() {
    this.ambient = [];
    for (let i = 0; i < 42; i++) {
      this.ambient.push({
        x: rand(0, this.W),
        y: rand(0, this.H),
        vx: rand(-9, 9),
        vy: rand(-9, 9),
        r: rand(0.8, 2.2),
        a: rand(0.03, 0.1),
        seed: rand(0, Math.PI * 2),
      });
    }
  }

  private reset() {
    const p = this.player;
    p.x = this.W / 2;
    p.y = this.H / 2;
    p.vx = 0;
    p.vy = 0;
    p.hp = PLAYER.maxHp;
    p.invuln = 0;
    p.muzzle = 0;
    p.kick = 0;
    this.weapon = "pistol";
    for (const w of WEAPON_LIST) {
      this.mags[w.id] = w.magSize;
      this.reserve[w.id] = START_RESERVE[w.id];
    }
    this.fireCd = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.dryCd = 0;
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.floaters = [];
    this.pickups = [];
    this.markers = [];
    this.queue = [];
    this.spawnT = 0;
    this.wave = 0;
    this.wavePhase = "intermission";
    this.intermission = 2.4;
    this.time = 0;
    this.score = 0;
    this.kills = 0;
    this.coins = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.newBest = false;
    this.hurtFlash = 0;
    this.shakeT = 0;
  }

  /* ---------------------------------------------------------------- */
  /* Waves & spawning                                                  */
  /* ---------------------------------------------------------------- */
  private startNextWave() {
    this.wave++;
    this.wavePhase = "combat";
    this.spawnT = 0;
    const w = this.wave;
    const total = Math.min(5 + Math.round(w * 2.6), 44);
    const interval = clamp(1.15 - w * 0.055, 0.3, 1.15);
    const q: { kind: EnemyKind; t: number }[] = [];
    for (let i = 0; i < total; i++) {
      const wGrunt = 3;
      const wRunner = w >= 2 ? 1 + w * 0.35 : 0;
      const wBrute = w >= 3 ? (w - 2) * 0.8 : 0;
      const sum = wGrunt + wRunner + wBrute;
      let roll = Math.random() * sum;
      let kind: EnemyKind = "grunt";
      if ((roll -= wBrute) < 0) kind = "brute";
      else if ((roll -= wRunner) < 0) kind = "runner";
      q.push({ kind, t: i * interval + rand(0, interval * 0.5) });
    }
    q.sort((a, b) => a.t - b.t);
    this.queue = q;
    this.sfx.wave();
    this.emit(true);
  }

  private spawnPoint(): { x: number; y: number } {
    const edge = Math.floor(rand(0, 4));
    const lo = this.pad + 30;
    if (edge === 0) return { x: rand(lo, this.W - lo), y: this.pad + 24 };
    if (edge === 1) return { x: rand(lo, this.W - lo), y: this.H - this.pad - 24 };
    if (edge === 2) return { x: this.pad + 24, y: rand(lo, this.H - lo) };
    return { x: this.W - this.pad - 24, y: rand(lo, this.H - lo) };
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number) {
    const def = ENEMIES[kind];
    const hpMul = 1 + (this.wave - 1) * 0.13;
    const spMul = 1 + Math.min((this.wave - 1) * 0.02, 0.3);
    this.enemies.push({
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      kbx: 0,
      kby: 0,
      r: def.radius,
      hp: def.hp * hpMul,
      maxHp: def.hp * hpMul,
      speed: def.speed * spMul,
      state: "chase",
      t: 0,
      cd: rand(0.3, 0.9),
      flash: 0,
      seed: rand(0, Math.PI * 2),
      angle: 0,
    });
    // pop-in particles
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 160);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35,
        max: 0.35,
        size: rand(2, 4),
        color: def.color,
        drag: 4,
        glow: true,
        shape: "dot",
        rot: 0,
        vrot: 0,
      });
    }
    this.sfx.spawn();
  }

  /* ---------------------------------------------------------------- */
  /* Combat helpers                                                    */
  /* ---------------------------------------------------------------- */
  private switchWeapon(id: WeaponId) {
    if (this.state !== "playing" || id === this.weapon) return;
    this.weapon = id;
    this.reloading = false;
    this.reloadT = 0;
    this.fireCd = Math.max(this.fireCd, 0.12);
    this.sfx.switchWeapon();
    this.emit(true);
  }

  private startReload() {
    if (this.state !== "playing" || this.reloading) return;
    const def = WEAPONS[this.weapon];
    if (this.mags[this.weapon] >= def.magSize || this.reserve[this.weapon] <= 0) return;
    this.reloading = true;
    this.reloadT = 0;
    this.sfx.reloadStart();
    this.emit(true);
  }

  private finishReload() {
    const def = WEAPONS[this.weapon];
    const need = def.magSize - this.mags[this.weapon];
    const take = Math.min(need, this.reserve[this.weapon]);
    this.mags[this.weapon] += take;
    this.reserve[this.weapon] -= take;
    this.reloading = false;
    this.sfx.reloadEnd();
    this.emit(true);
  }

  private tryFire() {
    const def = WEAPONS[this.weapon];
    if (this.mags[this.weapon] <= 0) {
      if (this.dryCd <= 0) {
        this.sfx.dry();
        this.dryCd = 0.25;
      }
      this.startReload();
      return;
    }
    this.mags[this.weapon]--;
    this.fireCd = 1 / def.fireRate;
    this.player.muzzle = 0.06;
    this.player.kick = 1;
    const p = this.player;
    const cos = Math.cos(p.aim);
    const sin = Math.sin(p.aim);
    // recoil impulse
    p.vx -= cos * def.recoil;
    p.vy -= sin * def.recoil;
    if (def.id === "shotgun") this.shake(5, 0.14);
    else this.shake(1.5, 0.06);

    if (def.id === "pistol") this.sfx.pistol();
    else if (def.id === "smg") this.sfx.smg();
    else this.sfx.shotgun();

    this.shotsFired += def.pellets;
    const originX = p.x + cos * (PLAYER.radius + def.barrel);
    const originY = p.y + sin * (PLAYER.radius + def.barrel);
    for (let i = 0; i < def.pellets; i++) {
      let ang: number;
      if (def.pellets > 1) {
        const f = def.pellets === 1 ? 0 : i / (def.pellets - 1) - 0.5;
        ang = p.aim + f * def.spread + rand(-1, 1) * def.spread * 0.35;
      } else {
        ang = p.aim + rand(-1, 1) * def.spread;
      }
      const speed = def.bulletSpeed * rand(0.94, 1.06);
      this.bullets.push({
        x: originX,
        y: originY,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        nx: Math.cos(ang),
        ny: Math.sin(ang),
        dmg: def.damage,
        dist: 0,
        maxDist: def.range * rand(0.9, 1.1),
        size: def.id === "shotgun" ? 2.6 : 3.4,
        color: def.color,
        kb: def.knockback,
        dead: false,
      });
    }
    // shell casing
    this.particles.push({
      x: p.x + cos * 10 - sin * 8,
      y: p.y + sin * 10 + cos * 8,
      vx: -sin * rand(70, 140) + rand(-20, 20),
      vy: cos * rand(70, 140) + rand(-20, 20),
      life: 0.55,
      max: 0.55,
      size: 3,
      color: "#d8a94e",
      drag: 5,
      glow: false,
      shape: "rect",
      rot: rand(0, Math.PI),
      vrot: rand(-12, 12),
    });
    this.emit();
  }

  private shake(mag: number, dur: number) {
    this.shakeMag = mag;
    this.shakeDur = dur;
    this.shakeT = dur;
  }

  private damagePlayer(dmg: number, fromX: number, fromY: number) {
    const p = this.player;
    if (p.invuln > 0 || this.state !== "playing") return;
    p.hp -= dmg;
    p.invuln = 0.7;
    this.hurtFlash = 1;
    this.shake(9, 0.35);
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    p.vx += (dx / d) * 260;
    p.vy += (dy / d) * 260;
    this.addFloater(p.x, p.y - 26, `-${dmg}`, "#ff5964", 17);
    this.sfx.hurt();
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(60, 220);
      this.particles.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4,
        max: 0.4,
        size: rand(2, 4),
        color: "#ff8a94",
        drag: 4,
        glow: true,
        shape: "dot",
        rot: 0,
        vrot: 0,
      });
    }
    if (p.hp <= 0) this.gameOver();
    this.emit(true);
  }

  private killEnemy(e: Enemy) {
    const def = ENEMIES[e.kind];
    this.kills++;
    this.score += def.score;
    this.addFloater(e.x, e.y - e.r - 10, `+${def.score}`, "#9dff3d", 15);
    // arcade pop: shards + ring, no gore
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(60, 300);
      this.particles.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.3, 0.6),
        max: 0.6,
        size: rand(2, 5),
        color: Math.random() < 0.6 ? def.color : "#ffffff",
        drag: 4,
        glow: true,
        shape: "dot",
        rot: 0,
        vrot: 0,
      });
    }
    this.particles.push({
      x: e.x,
      y: e.y,
      vx: 0,
      vy: 0,
      life: 0.35,
      max: 0.35,
      size: e.r * 0.6,
      color: def.color,
      drag: 0,
      glow: true,
      shape: "ring",
      rot: 0,
      vrot: 300,
    });
    if (e.kind === "brute") this.shake(8, 0.3);
    this.sfx.kill();
    // drop roll
    const roll = Math.random();
    if (roll < 0.38) {
      this.pickups.push({
        kind: "coin",
        x: e.x,
        y: e.y,
        vx: rand(-60, 60),
        vy: rand(-60, 60),
        t: 0,
        life: 14,
      });
    } else if (roll < 0.72) {
      this.pickups.push({
        kind: "ammo",
        x: e.x,
        y: e.y,
        vx: rand(-60, 60),
        vy: rand(-60, 60),
        t: 0,
        life: 14,
      });
    }
    this.emit();
  }

  private gameOver() {
    this.state = "gameover";
    const p = this.player;
    for (let i = 0; i < 36; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(80, 420);
      this.particles.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.4, 1),
        max: 1,
        size: rand(2, 6),
        color: Math.random() < 0.5 ? "#4de3ff" : "#ffffff",
        drag: 3,
        glow: true,
        shape: "dot",
        rot: 0,
        vrot: 0,
      });
    }
    this.particles.push({
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      life: 0.6,
      max: 0.6,
      size: 10,
      color: "#4de3ff",
      drag: 0,
      glow: true,
      shape: "ring",
      rot: 0,
      vrot: 500,
    });
    this.shake(14, 0.6);
    this.sfx.gameOver();
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        /* ignore */
      }
    }
    this.emit(true);
  }

  private addFloater(x: number, y: number, text: string, color: string, size: number) {
    if (this.floaters.length > 40) this.floaters.shift();
    this.floaters.push({ x, y, text, color, t: 0, life: 0.9, size });
  }

  /* ---------------------------------------------------------------- */
  /* Main loop                                                         */
  /* ---------------------------------------------------------------- */
  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    this.updateAmbient(dt);
    if (this.state === "playing") this.update(dt);
    else if (this.state === "gameover") this.updateFx(dt);
    this.render();
  };

  private updateFx(dt: number) {
    this.updateParticles(dt);
    this.updateFloaters(dt);
    if (this.shakeT > 0) this.shakeT -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
  }

  private updateAmbient(dt: number) {
    for (const d of this.ambient) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < 0) d.x += this.W;
      if (d.x > this.W) d.x -= this.W;
      if (d.y < 0) d.y += this.H;
      if (d.y > this.H) d.y -= this.H;
    }
  }

  private update(dt: number) {
    this.time += dt;
    const p = this.player;
    const def = WEAPONS[this.weapon];

    /* ----- player movement ----- */
    let ix = 0;
    let iy = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) iy -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) iy += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) ix -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) ix += 1;
    const il = Math.hypot(ix, iy);
    if (il > 0) {
      ix /= il;
      iy /= il;
    }
    const k = 1 - Math.exp(-14 * dt);
    p.vx += (ix * PLAYER.speed - p.vx) * k;
    p.vy += (iy * PLAYER.speed - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, this.pad + PLAYER.radius, this.W - this.pad - PLAYER.radius);
    p.y = clamp(p.y, this.pad + PLAYER.radius, this.H - this.pad - PLAYER.radius);
    p.moving = Math.hypot(p.vx, p.vy) > 30;
    if (p.moving) p.bob += dt * 11;
    p.invuln = Math.max(0, p.invuln - dt);
    p.muzzle = Math.max(0, p.muzzle - dt);
    p.kick = Math.max(0, p.kick - dt * 6);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
    if (this.shakeT > 0) this.shakeT -= dt;

    // movement dust
    p.dustT -= dt;
    if (p.moving && p.dustT <= 0) {
      p.dustT = 0.09;
      this.particles.push({
        x: p.x - (p.vx / PLAYER.speed) * 12 + rand(-4, 4),
        y: p.y - (p.vy / PLAYER.speed) * 12 + rand(-4, 4),
        vx: rand(-14, 14),
        vy: rand(-14, 14),
        life: 0.4,
        max: 0.4,
        size: rand(1.5, 3),
        color: "#5d8a72",
        drag: 3,
        glow: false,
        shape: "dot",
        rot: 0,
        vrot: 0,
      });
    }

    /* ----- aiming ----- */
    p.aim = Math.atan2(this.mouse.y - p.y, this.mouse.x - p.x);

    /* ----- reload ----- */
    this.dryCd -= dt;
    this.fireCd -= dt;
    this.hitSndCd -= dt;
    if (this.reloading) {
      this.reloadT += dt;
      if (this.reloadT >= def.reloadTime) this.finishReload();
    }

    /* ----- firing ----- */
    if (this.mouse.down && !this.reloading && this.fireCd <= 0) {
      this.tryFire();
    }

    /* ----- bullets ----- */
    const dmgMap = new Map<Enemy, { total: number; kx: number; ky: number }>();
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.dist += Math.hypot(b.vx, b.vy) * dt;
      if (
        b.dist >= b.maxDist ||
        b.x < this.pad ||
        b.x > this.W - this.pad ||
        b.y < this.pad ||
        b.y > this.H - this.pad
      ) {
        b.dead = true;
        this.spark(b.x, b.y, b.color, 4, 120);
        continue;
      }
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const rr = e.r + b.size;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (dx * dx + dy * dy < rr * rr) {
          b.dead = true;
          e.hp -= b.dmg;
          e.flash = 1;
          const acc = dmgMap.get(e) ?? { total: 0, kx: 0, ky: 0 };
          acc.total += b.dmg;
          acc.kx += b.nx * b.kb;
          acc.ky += b.ny * b.kb;
          dmgMap.set(e, acc);
          this.shotsHit++;
          this.spark(b.x, b.y, b.color, 5, 190);
          if (this.hitSndCd <= 0) {
            this.sfx.hit();
            this.hitSndCd = 0.04;
          }
          break;
        }
      }
    }
    // apply knockback + damage numbers
    for (const [e, acc] of dmgMap) {
      e.kbx += acc.kx;
      e.kby += acc.ky;
      this.addFloater(
        e.x + rand(-8, 8),
        e.y - e.r - 8,
        String(Math.round(acc.total)),
        "#ffffff",
        acc.total >= 60 ? 17 : 13,
      );
      if (e.hp <= 0) this.killEnemy(e);
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    /* ----- spawn queue ----- */
    if (this.wavePhase === "combat" && this.queue.length > 0) {
      this.spawnT += dt;
      while (this.queue.length > 0 && this.queue[0].t <= this.spawnT) {
        const item = this.queue.shift()!;
        const pt = this.spawnPoint();
        this.markers.push({
          x: pt.x,
          y: pt.y,
          t: 0,
          dur: 0.65,
          kind: item.kind,
        });
      }
    }

    /* ----- spawn markers ----- */
    for (const m of this.markers) m.t += dt;
    const ready = this.markers.filter((m) => m.t >= m.dur);
    if (ready.length > 0) {
      this.markers = this.markers.filter((m) => m.t < m.dur);
      for (const m of ready) this.spawnEnemy(m.kind, m.x, m.y);
    }

    /* ----- enemies ----- */
    for (const e of this.enemies) {
      const edef = ENEMIES[e.kind];
      e.flash = Math.max(0, e.flash - dt * 6);
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.angle = Math.atan2(dy, dx);

      if (e.state === "chase") {
        e.cd -= dt;
        // separation from other enemies
        let sx = 0;
        let sy = 0;
        for (const o of this.enemies) {
          if (o === e) continue;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const od = Math.hypot(ox, oy);
          const min = e.r + o.r + 2;
          if (od > 0 && od < min) {
            sx += (ox / od) * (min - od);
            sy += (oy / od) * (min - od);
          }
        }
        e.vx = (dx / d) * e.speed + sx * 6;
        e.vy = (dy / d) * e.speed + sy * 6;
        if (e.cd <= 0 && d < edef.attackRange + PLAYER.radius + e.r) {
          e.state = "windup";
          e.t = 0;
          e.vx = 0;
          e.vy = 0;
        }
      } else if (e.state === "windup") {
        e.t += dt;
        e.vx = 0;
        e.vy = 0;
        if (e.t >= edef.windup) {
          // strike
          if (d < (edef.attackRange + PLAYER.radius + e.r) * 1.35) {
            this.damagePlayer(edef.damage, e.x, e.y);
          }
          this.particles.push({
            x: e.x + (dx / d) * e.r,
            y: e.y + (dy / d) * e.r,
            vx: 0,
            vy: 0,
            life: 0.25,
            max: 0.25,
            size: 8,
            color: "#ffffff",
            drag: 0,
            glow: true,
            shape: "ring",
            rot: 0,
            vrot: 260,
          });
          e.state = "recover";
          e.t = 0;
          e.cd = edef.cooldown;
        }
      } else {
        // recover
        e.t += dt;
        if (e.t > 0.35) e.state = "chase";
      }

      // knockback decay
      const kbDecay = Math.exp(-8 * dt);
      e.kbx *= kbDecay;
      e.kby *= kbDecay;
      e.x += (e.vx + e.kbx) * dt;
      e.y += (e.vy + e.kby) * dt;
      // soft contact: enemies push against the player, never inside
      const pd = Math.hypot(p.x - e.x, p.y - e.y);
      const minD = e.r + PLAYER.radius - 2;
      if (pd > 0 && pd < minD) {
        e.x += ((e.x - p.x) / pd) * (minD - pd);
        e.y += ((e.y - p.y) / pd) * (minD - pd);
      }
      e.x = clamp(e.x, this.pad + e.r, this.W - this.pad - e.r);
      e.y = clamp(e.y, this.pad + e.r, this.H - this.pad - e.r);
    }

    /* ----- pickups ----- */
    for (const pk of this.pickups) {
      pk.t += dt;
      pk.life -= dt;
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 120) {
        const pull = (1 - d / 120) * 500;
        pk.vx += (dx / d) * pull * dt * 4;
        pk.vy += (dy / d) * pull * dt * 4;
      }
      const drag = Math.exp(-3 * dt);
      pk.vx *= drag;
      pk.vy *= drag;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      if (d < PLAYER.radius + 16) {
        pk.life = 0;
        if (pk.kind === "coin") {
          this.coins++;
          this.score += 25;
          this.addFloater(pk.x, pk.y - 14, "+25", "#ffcf4d", 14);
          this.sfx.coin();
        } else {
          for (const w of WEAPON_LIST) {
            this.reserve[w.id] += AMMO_PACK[w.id];
          }
          this.addFloater(pk.x, pk.y - 14, "+AMMO", "#9dff3d", 14);
          this.sfx.ammo();
        }
        this.spark(pk.x, pk.y, pk.kind === "coin" ? "#ffcf4d" : "#9dff3d", 8, 160);
        this.emit();
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);

    /* ----- wave flow ----- */
    if (this.wavePhase === "intermission") {
      this.intermission -= dt;
      if (this.intermission <= 0) this.startNextWave();
    } else if (
      this.queue.length === 0 &&
      this.markers.length === 0 &&
      this.enemies.length === 0
    ) {
      // wave cleared
      const bonus = 100 + this.wave * 50;
      this.score += bonus;
      const heal = Math.min(15, PLAYER.maxHp - p.hp);
      p.hp += heal;
      this.addFloater(p.x, p.y - 34, `+${bonus} CLEAR`, "#ffb02e", 17);
      if (heal > 0) this.addFloater(p.x, p.y - 52, `+${Math.round(heal)} HP`, "#9dff3d", 14);
      this.sfx.waveClear();
      this.wavePhase = "intermission";
      this.intermission = 3.4;
      this.emit(true);
    }

    /* ----- fx ----- */
    this.updateParticles(dt);
    this.updateFloaters(dt);

    /* ----- HUD sync ----- */
    this.hudAcc += dt;
    if (this.hudAcc >= 0.1) this.emit();
  }

  private spark(x: number, y: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.4, speed);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.15, 0.35),
        max: 0.35,
        size: rand(1.5, 3),
        color,
        drag: 5,
        glow: true,
        shape: "dot",
        rot: 0,
        vrot: 0,
      });
    }
  }

  private updateParticles(dt: number) {
    for (const pt of this.particles) {
      pt.life -= dt;
      const drag = Math.exp(-pt.drag * dt);
      pt.vx *= drag;
      pt.vy *= drag;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.rot += pt.vrot * dt;
      if (pt.shape === "ring") pt.size += pt.vrot * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    if (this.particles.length > 500) {
      this.particles.splice(0, this.particles.length - 500);
    }
  }

  private updateFloaters(dt: number) {
    for (const f of this.floaters) {
      f.t += dt;
      f.y -= 44 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.t < f.life);
  }

  private emit(force = false) {
    if (!this.onHud) return;
    if (!force && this.hudAcc < 0.1) return;
    this.hudAcc = 0;
    this.onHud(this.snapshot());
  }

  /* ---------------------------------------------------------------- */
  /* Rendering                                                         */
  /* ---------------------------------------------------------------- */
  private render() {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    let ox = 0;
    let oy = 0;
    if (this.shakeT > 0) {
      const kk = this.shakeT / this.shakeDur;
      ox = rand(-1, 1) * this.shakeMag * kk;
      oy = rand(-1, 1) * this.shakeMag * kk;
    }
    c.save();
    c.translate(ox, oy);

    if (this.floor) c.drawImage(this.floor, 0, 0, this.W, this.H);

    // ambient dust
    for (const d of this.ambient) {
      c.globalAlpha = d.a * (0.7 + 0.3 * Math.sin(performance.now() / 900 + d.seed));
      c.fillStyle = "#a8ffc9";
      c.beginPath();
      c.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    this.drawMarkers(c);
    this.drawPickups(c);
    this.drawBullets(c);
    this.drawEnemies(c);
    if (this.state !== "menu") this.drawPlayer(c);
    this.drawParticles(c);
    this.drawFloaters(c);
    if (this.state === "playing") this.drawCrosshair(c);

    c.restore();

    /* full-screen overlays (not shaken) */
    // hurt flash
    if (this.hurtFlash > 0) {
      const g = c.createRadialGradient(
        this.W / 2,
        this.H / 2,
        Math.min(this.W, this.H) * 0.3,
        this.W / 2,
        this.H / 2,
        Math.max(this.W, this.H) * 0.72,
      );
      g.addColorStop(0, "rgba(255,60,70,0)");
      g.addColorStop(1, `rgba(255,45,60,${0.4 * this.hurtFlash})`);
      c.fillStyle = g;
      c.fillRect(0, 0, this.W, this.H);
    }
    // low hp pulse
    const p = this.player;
    if (this.state === "playing" && p.hp < 30) {
      const a = (0.1 + 0.08 * Math.sin(this.time * 6)) * (1 - p.hp / 30);
      const g = c.createRadialGradient(
        this.W / 2,
        this.H / 2,
        Math.min(this.W, this.H) * 0.32,
        this.W / 2,
        this.H / 2,
        Math.max(this.W, this.H) * 0.72,
      );
      g.addColorStop(0, "rgba(255,40,50,0)");
      g.addColorStop(1, `rgba(255,30,45,${a})`);
      c.fillStyle = g;
      c.fillRect(0, 0, this.W, this.H);
    }
  }

  private drawMarkers(c: CanvasRenderingContext2D) {
    for (const m of this.markers) {
      const def = ENEMIES[m.kind];
      const f = m.t / m.dur;
      const pulse = 0.5 + 0.5 * Math.sin(m.t * 18);
      c.save();
      c.translate(m.x, m.y);
      c.globalAlpha = 0.25 + 0.55 * f;
      c.strokeStyle = def.color;
      c.lineWidth = 2;
      c.setLineDash([6, 6]);
      c.lineDashOffset = -m.t * 40;
      c.beginPath();
      c.arc(0, 0, def.radius + 8 + pulse * 4, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 0.5 * f;
      c.fillStyle = def.color;
      c.beginPath();
      c.arc(0, 0, def.radius * f, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    c.globalAlpha = 1;
  }

  private drawPickups(c: CanvasRenderingContext2D) {
    for (const pk of this.pickups) {
      const bobY = Math.sin(pk.t * 4) * 3;
      const blink = pk.life < 3 ? (Math.sin(pk.t * 20) > 0 ? 1 : 0.3) : 1;
      c.save();
      c.translate(pk.x, pk.y + bobY);
      c.globalAlpha = blink;
      if (pk.kind === "coin") {
        const spin = Math.abs(Math.sin(pk.t * 3));
        c.scale(Math.max(0.25, spin), 1);
        c.fillStyle = "#ffcf4d";
        c.beginPath();
        c.arc(0, 0, 9, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#9a6a12";
        c.lineWidth = 2;
        c.stroke();
        c.fillStyle = "#ffe9a8";
        c.fillRect(-2, -5, 4, 10);
      } else {
        c.fillStyle = "#1d3325";
        c.strokeStyle = "#9dff3d";
        c.lineWidth = 1.5;
        c.fillRect(-10, -7, 20, 14);
        c.strokeRect(-10, -7, 20, 14);
        c.fillStyle = "#ffcf4d";
        c.fillRect(-6, -3, 4, 7);
        c.fillRect(0, -3, 4, 7);
        c.fillStyle = "#9dff3d";
        c.fillRect(-6, -5, 4, 2);
        c.fillRect(0, -5, 4, 2);
      }
      c.restore();
    }
    c.globalAlpha = 1;
  }

  private drawBullets(c: CanvasRenderingContext2D) {
    c.save();
    c.globalCompositeOperation = "lighter";
    c.lineCap = "round";
    for (const b of this.bullets) {
      const tailX = b.x - b.vx * 0.022;
      const tailY = b.y - b.vy * 0.022;
      c.strokeStyle = b.color;
      c.globalAlpha = 0.85;
      c.lineWidth = b.size * 1.5;
      c.beginPath();
      c.moveTo(tailX, tailY);
      c.lineTo(b.x, b.y);
      c.stroke();
      c.strokeStyle = "#ffffff";
      c.globalAlpha = 0.9;
      c.lineWidth = b.size * 0.6;
      c.beginPath();
      c.moveTo(b.x - b.vx * 0.01, b.y - b.vy * 0.01);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    c.restore();
  }

  private drawEnemies(c: CanvasRenderingContext2D) {
    const now = performance.now() / 1000;
    for (const e of this.enemies) {
      const def = ENEMIES[e.kind];
      const wobble = Math.sin(now * 9 + e.seed) * 1.6;
      c.save();
      c.translate(e.x, e.y);

      // attack telegraph ring
      if (e.state === "windup") {
        const f = clamp(e.t / def.windup, 0, 1);
        const reach = def.attackRange + e.r + PLAYER.radius;
        c.globalAlpha = 0.16 + 0.2 * f;
        c.fillStyle = "#ff3b4a";
        c.beginPath();
        c.arc(0, 0, reach * (0.4 + 0.6 * f), 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 0.5;
        c.strokeStyle = "#ff3b4a";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, reach, 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
      }

      // shadow
      c.globalAlpha = 0.35;
      c.fillStyle = "#000000";
      c.beginPath();
      c.ellipse(0, e.r * 0.7, e.r * 0.9, e.r * 0.4, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;

      const squish = e.state === "windup" ? 1 + 0.15 * Math.sin(clamp(e.t / def.windup, 0, 1) * Math.PI) : 1;
      c.scale(squish, 2 - squish > 0 ? 2 - squish : 1);

      if (e.kind === "runner") {
        c.rotate(e.angle);
        // speed trail
        c.globalAlpha = 0.14;
        c.fillStyle = def.color;
        c.beginPath();
        c.arc(-e.r * 1.1, 0, e.r * 0.85, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 0.07;
        c.beginPath();
        c.arc(-e.r * 1.9, 0, e.r * 0.7, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
        c.scale(1.25, 0.88);
      }

      // body
      c.fillStyle = def.dark;
      c.beginPath();
      c.arc(0, wobble * 0.3, e.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = def.color;
      c.beginPath();
      c.arc(-e.r * 0.12, -e.r * 0.14 + wobble * 0.3, e.r * 0.82, 0, Math.PI * 2);
      c.fill();

      if (e.kind === "brute") {
        // armor plates
        c.strokeStyle = def.dark;
        c.lineWidth = 5;
        for (const a0 of [-2.4, -0.5, 1.4]) {
          c.beginPath();
          c.arc(0, wobble * 0.3, e.r - 4, a0, a0 + 1.1);
          c.stroke();
        }
        // horns
        c.fillStyle = def.dark;
        c.beginPath();
        c.moveTo(-e.r * 0.7, -e.r * 0.55);
        c.lineTo(-e.r * 1.05, -e.r * 1.05);
        c.lineTo(-e.r * 0.35, -e.r * 0.85);
        c.closePath();
        c.fill();
        c.beginPath();
        c.moveTo(e.r * 0.7, -e.r * 0.55);
        c.lineTo(e.r * 1.05, -e.r * 1.05);
        c.lineTo(e.r * 0.35, -e.r * 0.85);
        c.closePath();
        c.fill();
      }

      // eyes look at player (runner already rotated)
      const ea = e.kind === "runner" ? 0 : e.angle;
      const exo = Math.cos(ea) * e.r * 0.34;
      const eyo = Math.sin(ea) * e.r * 0.34 + wobble * 0.3;
      const perp = ea + Math.PI / 2;
      const eyeR = e.kind === "brute" ? e.r * 0.13 : e.r * 0.18;
      for (const s of [-1, 1]) {
        const ex = exo + Math.cos(perp) * e.r * 0.34 * s;
        const ey = eyo + Math.sin(perp) * e.r * 0.34 * s;
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.arc(ex, ey, eyeR, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#1a1026";
        c.beginPath();
        c.arc(ex + Math.cos(ea) * eyeR * 0.4, ey + Math.sin(ea) * eyeR * 0.4, eyeR * 0.55, 0, Math.PI * 2);
        c.fill();
      }

      // hit flash (arcade white pop)
      if (e.flash > 0) {
        c.globalAlpha = e.flash * 0.85;
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.arc(0, wobble * 0.3, e.r * 1.02, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
      }
      c.restore();

      // health bar
      if (e.hp < e.maxHp) {
        const w = clamp(e.r * 2.2, 26, 62);
        const pct = clamp(e.hp / e.maxHp, 0, 1);
        const bx = e.x - w / 2;
        const by = e.y - e.r - 13;
        c.fillStyle = "rgba(4,10,8,0.75)";
        c.fillRect(bx - 1, by - 1, w + 2, 6);
        c.fillStyle = pct > 0.55 ? "#9dff3d" : pct > 0.28 ? "#ffb02e" : "#ff5964";
        c.fillRect(bx, by, w * pct, 4);
      }
    }
  }

  private drawPlayer(c: CanvasRenderingContext2D) {
    const p = this.player;
    const def = WEAPONS[this.weapon];
    const dead = this.state === "gameover";
    c.save();
    c.translate(p.x, p.y);

    if (!dead) {
      // shadow
      c.globalAlpha = 0.4;
      c.fillStyle = "#000000";
      c.beginPath();
      c.ellipse(0, PLAYER.radius * 0.75, PLAYER.radius * 0.95, PLAYER.radius * 0.42, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;

      // invuln blink
      if (p.invuln > 0 && Math.floor(performance.now() / 60) % 2 === 0) c.globalAlpha = 0.45;

      const bobY = p.moving ? Math.sin(p.bob) * 1.6 : 0;

      // gun (under body rim, over shadow)
      c.save();
      c.rotate(p.aim);
      c.translate(2, 0);
      c.fillStyle = "#24343d";
      if (def.id === "pistol") {
        c.fillRect(4, -3, 18, 6);
        c.fillStyle = "#ffe08a";
        c.fillRect(19, -2, 3, 4);
      } else if (def.id === "smg") {
        c.fillRect(4, -2.5, 26, 5);
        c.fillRect(12, 2, 5, 9);
        c.fillStyle = "#7de8ff";
        c.fillRect(27, -1.5, 3, 3);
      } else {
        c.fillRect(2, -4.5, 24, 9);
        c.fillStyle = "#141f25";
        c.fillRect(2, -1, 24, 2);
        c.fillStyle = "#3a4d57";
        c.fillRect(10, -5.5, 7, 11);
        c.fillStyle = "#ffb46b";
        c.fillRect(23, -3, 3, 6);
      }
      c.restore();

      // body
      c.translate(0, bobY);
      c.fillStyle = "#16323c";
      c.beginPath();
      c.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#4de3ff";
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(0, 0, PLAYER.radius - 1, 0, Math.PI * 2);
      c.stroke();
      // inner core
      c.fillStyle = "#0d2028";
      c.beginPath();
      c.arc(0, 0, PLAYER.radius * 0.62, 0, Math.PI * 2);
      c.fill();
      // visor facing aim
      c.strokeStyle = "#8ff4ff";
      c.lineWidth = 3.5;
      c.beginPath();
      c.arc(0, 0, PLAYER.radius * 0.62, p.aim - 0.65, p.aim + 0.65);
      c.stroke();
      // core dot
      c.fillStyle = "#4de3ff";
      c.beginPath();
      c.arc(0, 0, 3.2, 0, Math.PI * 2);
      c.fill();

      // muzzle flash
      if (p.muzzle > 0 && !this.reloading) {
        const mx = Math.cos(p.aim) * (PLAYER.radius + def.barrel + 6);
        const my = Math.sin(p.aim) * (PLAYER.radius + def.barrel + 6);
        const f = p.muzzle / 0.06;
        c.save();
        c.globalCompositeOperation = "lighter";
        c.translate(mx, my);
        c.rotate(p.aim);
        c.globalAlpha = f;
        c.fillStyle = "#fff3c4";
        const L = def.id === "shotgun" ? 26 : 17;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(L, -6 * f);
        c.lineTo(L * 1.35, 0);
        c.lineTo(L, 6 * f);
        c.closePath();
        c.fill();
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 20);
        g.addColorStop(0, "rgba(255,224,138,0.9)");
        g.addColorStop(1, "rgba(255,224,138,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, 20, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }

      // reload progress ring
      if (this.reloading) {
        const f = clamp(this.reloadT / def.reloadTime, 0, 1);
        c.globalAlpha = 1;
        c.strokeStyle = "rgba(6,14,11,0.8)";
        c.lineWidth = 5;
        c.beginPath();
        c.arc(0, -bobY, PLAYER.radius + 9, 0, Math.PI * 2);
        c.stroke();
        c.strokeStyle = "#ffb02e";
        c.lineWidth = 4;
        c.beginPath();
        c.arc(0, -bobY, PLAYER.radius + 9, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
        c.stroke();
      }
    }
    c.restore();
    c.globalAlpha = 1;
  }

  private drawParticles(c: CanvasRenderingContext2D) {
    // non-glow pass
    for (const pt of this.particles) {
      if (pt.glow) continue;
      const a = clamp(pt.life / pt.max, 0, 1);
      c.globalAlpha = a;
      c.fillStyle = pt.color;
      if (pt.shape === "rect") {
        c.save();
        c.translate(pt.x, pt.y);
        c.rotate(pt.rot);
        c.fillRect(-pt.size, -pt.size * 0.5, pt.size * 2, pt.size);
        c.restore();
      } else {
        c.beginPath();
        c.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;
    // glow pass
    c.save();
    c.globalCompositeOperation = "lighter";
    for (const pt of this.particles) {
      if (!pt.glow) continue;
      const a = clamp(pt.life / pt.max, 0, 1);
      c.globalAlpha = a;
      if (pt.shape === "ring") {
        c.strokeStyle = pt.color;
        c.lineWidth = 3 * a + 1;
        c.beginPath();
        c.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        c.stroke();
      } else {
        c.fillStyle = pt.color;
        c.beginPath();
        c.arc(pt.x, pt.y, pt.size * (0.5 + 0.5 * a), 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
    c.globalAlpha = 1;
  }

  private drawFloaters(c: CanvasRenderingContext2D) {
    c.textAlign = "center";
    for (const f of this.floaters) {
      const a = clamp(1 - f.t / f.life, 0, 1);
      c.globalAlpha = a;
      c.font = `700 ${f.size}px "Chakra Petch", sans-serif`;
      c.strokeStyle = "rgba(4,10,8,0.9)";
      c.lineWidth = 3;
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
  }

  private drawCrosshair(c: CanvasRenderingContext2D) {
    const m = this.mouse;
    const gap = 7 + this.player.kick * 9;
    c.save();
    c.translate(m.x, m.y);
    c.strokeStyle = "#9dff3d";
    c.lineWidth = 2;
    c.globalAlpha = 0.95;
    c.beginPath();
    c.arc(0, 0, 2, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 2);
      c.beginPath();
      c.moveTo(gap, 0);
      c.lineTo(gap + 7, 0);
      c.stroke();
    }
    c.globalAlpha = 0.35;
    c.beginPath();
    c.arc(0, 0, gap + 11, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  /* ---------------------------------------------------------------- */
  /* Static floor (pre-rendered)                                       */
  /* ---------------------------------------------------------------- */
  private buildFloor() {
    const f = document.createElement("canvas");
    f.width = Math.floor(this.W * this.dpr);
    f.height = Math.floor(this.H * this.dpr);
    const g = f.getContext("2d");
    if (!g) return;
    g.scale(this.dpr, this.dpr);
    const W = this.W;
    const H = this.H;
    const pad = this.pad;

    // base
    g.fillStyle = "#0a1411";
    g.fillRect(0, 0, W, H);

    // center light
    const lg = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, Math.max(W, H) * 0.65);
    lg.addColorStop(0, "rgba(96,255,178,0.065)");
    lg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = lg;
    g.fillRect(0, 0, W, H);

    // grid
    g.lineWidth = 1;
    g.strokeStyle = "rgba(143,255,180,0.05)";
    for (let x = pad; x <= W - pad; x += 48) {
      g.beginPath();
      g.moveTo(x, pad);
      g.lineTo(x, H - pad);
      g.stroke();
    }
    for (let y = pad; y <= H - pad; y += 48) {
      g.beginPath();
      g.moveTo(pad, y);
      g.lineTo(W - pad, y);
      g.stroke();
    }
    g.strokeStyle = "rgba(143,255,180,0.08)";
    for (let x = pad; x <= W - pad; x += 240) {
      g.beginPath();
      g.moveTo(x, pad);
      g.lineTo(x, H - pad);
      g.stroke();
    }
    for (let y = pad; y <= H - pad; y += 240) {
      g.beginPath();
      g.moveTo(pad, y);
      g.lineTo(W - pad, y);
      g.stroke();
    }

    // scratches & grime
    for (let i = 0; i < 70; i++) {
      const x = rand(pad, W - pad);
      const y = rand(pad, H - pad);
      const a = rand(0, Math.PI * 2);
      const len = rand(8, 50);
      g.strokeStyle = `rgba(190,255,220,${rand(0.015, 0.045)})`;
      g.lineWidth = rand(0.6, 1.6);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(190,255,220,${rand(0.02, 0.06)})`;
      g.beginPath();
      g.arc(rand(pad, W - pad), rand(pad, H - pad), rand(0.6, 1.8), 0, Math.PI * 2);
      g.fill();
    }

    // center landing-pad decal
    g.save();
    g.translate(W / 2, H / 2);
    g.strokeStyle = "rgba(157,255,61,0.07)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, 92, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 22;
    g.strokeStyle = "rgba(157,255,61,0.045)";
    g.beginPath();
    g.moveTo(-130, -130);
    g.lineTo(130, 130);
    g.moveTo(130, -130);
    g.lineTo(-130, 130);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 2);
      g.strokeStyle = "rgba(157,255,61,0.12)";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(104, 0);
      g.lineTo(118, 0);
      g.stroke();
    }
    g.restore();

    // outer wall region
    g.fillStyle = "#060b09";
    g.fillRect(0, 0, W, pad);
    g.fillRect(0, H - pad, W, pad);
    g.fillRect(0, 0, pad, H);
    g.fillRect(W - pad, 0, pad, H);

    // hazard stripe bands on inner wall edge
    const pc = document.createElement("canvas");
    pc.width = 16;
    pc.height = 16;
    const pg = pc.getContext("2d");
    if (pg) {
      pg.fillStyle = "#101815";
      pg.fillRect(0, 0, 16, 16);
      pg.strokeStyle = "#ffb02e";
      pg.lineWidth = 6;
      for (const o of [-16, 0, 16]) {
        pg.beginPath();
        pg.moveTo(o - 4, 20);
        pg.lineTo(o + 20, -4);
        pg.stroke();
      }
      const pat = g.createPattern(pc, "repeat");
      if (pat) {
        g.globalAlpha = 0.4;
        g.fillStyle = pat;
        g.fillRect(pad, pad, W - pad * 2, 8);
        g.fillRect(pad, H - pad - 8, W - pad * 2, 8);
        g.fillRect(pad, pad, 8, H - pad * 2);
        g.fillRect(W - pad - 8, pad, 8, H - pad * 2);
        g.globalAlpha = 1;
      }
    }

    // inner border + corner brackets
    g.strokeStyle = "rgba(157,255,61,0.3)";
    g.lineWidth = 2;
    g.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
    g.strokeStyle = "rgba(157,255,61,0.75)";
    g.lineWidth = 3;
    const bl = 26;
    for (const [cx, cy, sx, sy] of [
      [pad, pad, 1, 1],
      [W - pad, pad, -1, 1],
      [pad, H - pad, 1, -1],
      [W - pad, H - pad, -1, -1],
    ] as const) {
      g.beginPath();
      g.moveTo(cx + sx * bl, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy + sy * bl);
      g.stroke();
    }

    // vignette
    const vg = g.createRadialGradient(
      W / 2,
      H / 2,
      Math.min(W, H) * 0.35,
      W / 2,
      H / 2,
      Math.max(W, H) * 0.78,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    this.floor = f;
  }
}
