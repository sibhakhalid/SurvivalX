export type WeaponId = "pistol" | "smg" | "shotgun";
export type EnemyKind = "grunt" | "runner" | "brute";
export type GameState = "menu" | "playing" | "paused" | "gameover";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  tag: string;
  hotkey: string;
  damage: number;
  fireRate: number; // shots per second
  magSize: number;
  reloadTime: number; // seconds
  bulletSpeed: number; // px/s
  range: number; // px
  spread: number; // radians
  pellets: number;
  knockback: number;
  recoil: number;
  barrel: number; // barrel length for drawing / muzzle offset
  color: string; // tracer color
}

export const WEAPON_LIST: WeaponDef[] = [
  {
    id: "pistol",
    name: "P-9 SIDEARM",
    tag: "PISTOL",
    hotkey: "1",
    damage: 34,
    fireRate: 3.6,
    magSize: 12,
    reloadTime: 1.0,
    bulletSpeed: 960,
    range: 660,
    spread: 0.035,
    pellets: 1,
    knockback: 110,
    recoil: 46,
    barrel: 22,
    color: "#ffe08a",
  },
  {
    id: "smg",
    name: "VX-7 SPRAYER",
    tag: "SMG",
    hotkey: "2",
    damage: 13,
    fireRate: 11,
    magSize: 32,
    reloadTime: 1.5,
    bulletSpeed: 880,
    range: 470,
    spread: 0.1,
    pellets: 1,
    knockback: 60,
    recoil: 26,
    barrel: 30,
    color: "#7de8ff",
  },
  {
    id: "shotgun",
    name: "M-87 BREACHER",
    tag: "SHOTGUN",
    hotkey: "3",
    damage: 11,
    fireRate: 1.5,
    magSize: 6,
    reloadTime: 2.0,
    bulletSpeed: 800,
    range: 300,
    spread: 0.34,
    pellets: 8,
    knockback: 260,
    recoil: 160,
    barrel: 26,
    color: "#ffb46b",
  },
];

export const WEAPONS = Object.fromEntries(
  WEAPON_LIST.map((w) => [w.id, w]),
) as Record<WeaponId, WeaponDef>;

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  score: number;
  attackRange: number; // extra reach beyond body radii
  windup: number; // telegraph time before hit lands
  cooldown: number; // time between attacks
  color: string;
  dark: string;
  blurb: string;
}

export const ENEMY_LIST: EnemyDef[] = [
  {
    kind: "grunt",
    name: "GRUNT",
    hp: 55,
    speed: 96,
    damage: 12,
    radius: 16,
    score: 100,
    attackRange: 30,
    windup: 0.45,
    cooldown: 0.9,
    color: "#ff5964",
    dark: "#7e1c29",
    blurb: "Standard swarm unit. Slow but stubborn.",
  },
  {
    kind: "runner",
    name: "RUNNER",
    hp: 30,
    speed: 172,
    damage: 8,
    radius: 12,
    score: 150,
    attackRange: 26,
    windup: 0.3,
    cooldown: 0.65,
    color: "#ffa62b",
    dark: "#7d4a10",
    blurb: "Fast and fragile. Flanks in packs.",
  },
  {
    kind: "brute",
    name: "BRUTE",
    hp: 230,
    speed: 60,
    damage: 26,
    radius: 27,
    score: 400,
    attackRange: 46,
    windup: 0.75,
    cooldown: 1.5,
    color: "#b06bff",
    dark: "#4c2579",
    blurb: "Armored heavy. Hits like a truck.",
  },
];

export const ENEMIES = Object.fromEntries(
  ENEMY_LIST.map((e) => [e.kind, e]),
) as Record<EnemyKind, EnemyDef>;

export const PLAYER = {
  radius: 16,
  speed: 268,
  maxHp: 100,
} as const;

export const START_RESERVE: Record<WeaponId, number> = {
  pistol: 60,
  smg: 90,
  shotgun: 18,
};

export const AMMO_PACK: Record<WeaponId, number> = {
  pistol: 12,
  smg: 30,
  shotgun: 5,
};
