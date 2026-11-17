export const SHEET_URL =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261116_132032_30242d8c-5062-4d60-8a3d-238f0a2ff788.png&w=2200&q=85';

export const INTRO_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261116_131908_b6239896-c077-450c-ad91-575153973fcf.mp4';

export const SW = 2688;
export const SH = 1520;

export type Box = readonly [number, number, number, number];

export interface Flavour {
  id: number;
  name: string;
  shopLines: readonly [string, string];
  box: Box;
  color: string;
  bit: number;
  ingredients: string;
  barcode: string;
}

export const FLAVOURS: readonly Flavour[] = [
  {
    id: 0,
    name: 'Peanut Cocoa',
    shopLines: ['PEANUT', 'COCOA'],
    box: [98, 145, 403, 849],
    color: '#b79474',
    bit: 1,
    ingredients: 'Peanuts, oats, dates, cocoa, pea protein, sea salt.',
    barcode: '5 060912 400118',
  },
  {
    id: 1,
    name: 'Berry Oat',
    shopLines: ['BERRY', 'OAT'],
    box: [620, 145, 402, 849],
    color: '#ab9ac4',
    bit: 0,
    ingredients: 'Oats, blueberries, raspberries, dates, pea protein, almonds.',
    barcode: '5 060912 400125',
  },
  {
    id: 2,
    name: 'Salted Caramel',
    shopLines: ['SALTED', 'CARAMEL'],
    box: [1137, 145, 402, 849],
    color: '#d1ad6c',
    bit: 2,
    ingredients: 'Dates, cashews, oats, pea protein, sea salt, vanilla.',
    barcode: '5 060912 400132',
  },
  {
    id: 3,
    name: 'Mint Chip',
    shopLines: ['MINT', 'CHIP'],
    box: [1661, 145, 402, 849],
    color: '#94bdb4',
    bit: 3,
    ingredients: 'Oats, dark chocolate, almonds, pea protein, peppermint oil.',
    barcode: '5 060912 400149',
  },
  {
    id: 4,
    name: 'Strawberry',
    shopLines: ['STRAW-', 'BERRY'],
    box: [2184, 145, 403, 849],
    color: '#d396a7',
    bit: 4,
    ingredients: 'Oats, strawberries, dates, cashews, pea protein, lemon.',
    barcode: '5 060912 400156',
  },
];

export const BITS: readonly Box[] = [
  [650, 1090, 340, 305],  // 0: blueberries and raspberry
  [110, 1125, 280, 255],  // 1: chocolate chunks and peanuts
  [1175, 1110, 320, 285], // 2: salted caramel cube
  [1680, 1085, 380, 305], // 3: mint leaves and dark chocolate
  [2280, 1095, 250, 295], // 4: half strawberry
];

export interface HeroBitSpec {
  x: number;
  y: number;
  size: number;
  rot: number;
  bit: number;
  hideMobile?: boolean;
}

export const HERO_BITS: readonly HeroBitSpec[] = [
  { x: 0.12, y: 0.20, size: 120, rot: -18, bit: 0 },
  { x: 0.86, y: 0.18, size: 96, rot: 22, bit: 2, hideMobile: true },
  { x: 0.07, y: 0.74, size: 84, rot: 12, bit: 3 },
  { x: 0.655, y: 0.15, size: 78, rot: -10, bit: 4, hideMobile: true },
  { x: 0.205, y: 0.885, size: 70, rot: 30, bit: 1, hideMobile: true },
];

// [dx(u), dy(u), height(u), rz(deg), ry(deg)]
export const SLOTS: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 430, 0, 0],
  [245, 24, 330, 4, 16],
  [452, 44, 312, 8, 26],
  [660, 80, 296, 12, 34],
  [860, 118, 280, 15, 40],
];

export interface InsideStep {
  num: string;
  head: readonly string[];
  cap: readonly [string, string];
  ry: number;
}

export const INSIDE_STEPS: readonly InsideStep[] = [
  {
    num: '01',
    head: ['REAL FOOD,', 'FIRST'],
    cap: ['Oats, nuts, fruit.', "Nothing you can't say."],
    ry: 0,
  },
  {
    num: '02',
    head: ['PRESSED,', 'NOT BAKED'],
    cap: ['Real ingredients.', 'Clean energy.'],
    ry: 180,
  },
  {
    num: '03',
    head: ['WRAPPED', 'SAME DAY'],
    cap: ['Cold-pressed at dawn.', 'Sealed by noon.'],
    ry: 360,
  },
  {
    num: '04',
    head: ['BERRY', 'OAT'],
    cap: ['12g plant protein.', 'No crash.'],
    ry: 720,
  },
];

export function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function spriteStyle(box: Box, pad = 0): { backgroundSize: string; backgroundPosition: string } {
  const x = box[0] - pad;
  const y = box[1] - pad;
  const w = box[2] + pad * 2;
  const h = box[3] + pad * 2;
  return {
    backgroundSize: `${(SW / w) * 100}% ${(SH / h) * 100}%`,
    backgroundPosition: `${(x / (SW - w)) * 100}% ${(y / (SH - h)) * 100}%`,
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function mixHex(hexA: string, hexB: string, t: number): string {
  const a = hexA.replace('#', '');
  const b = hexB.replace('#', '');
  const ar = parseInt(a.slice(0, 2), 16);
  const ag = parseInt(a.slice(2, 4), 16);
  const ab = parseInt(a.slice(4, 6), 16);
  const br = parseInt(b.slice(0, 2), 16);
  const bg = parseInt(b.slice(2, 4), 16);
  const bb = parseInt(b.slice(4, 6), 16);
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const sampleDX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 6; i++) {
      const err = sampleX(u) - t;
      const d = sampleDX(u);
      if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    if (u < 0 || u > 1) {
      let lo = 0;
      let hi = 1;
      u = t;
      for (let i = 0; i < 12; i++) {
        const x = sampleX(u);
        if (Math.abs(x - t) < 1e-5) break;
        if (x < t) lo = u;
        else hi = u;
        u = 0.5 * (lo + hi);
      }
    }
    return sampleY(u);
  };
}

export function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
