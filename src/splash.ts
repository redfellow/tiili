/**
 * The startup splash: the tiili wordmark is scramble-typed, its brick dots are slapped on, a running-bond wall is
 * laid round it from the centre out, and the view dives into the `>_` focus brick, which becomes the first terminal.
 *
 * Everything but the mortar dust is a pure function of the timeline's time, so skipping just jumps ahead.
 * Explored in docs/brand/explorations/splash-preview.html.
 */

/** Brand bricks (docs/brand/tiili.css). */
const BRICK = { tiili: "#A4472B", klinkkeri: "#6B2A1E", savi: "#C9764F", laasti: "#E8DECD", graniitti: "#8D877D", koski: "#111617" };

/** The wordmark of docs/brand/logo/lockup-dark.svg, split into its letters: t i i l i. */
const WORD_D = "M155.46 94.72L147.14 94.72Q141.82 94.72 139.33 92.26Q136.83 89.79 136.83 84.42L136.83 67.58L131.33 67.58L131.33 60.42L136.83 60.42L136.83 52.35L146.43 52.35L146.43 60.42L155.46 60.42L155.46 67.58L146.43 67.58L146.43 83.26Q146.43 85.76 147.49 86.66Q148.54 87.55 150.66 87.55L155.46 87.55M168.77 94.72L159.17 94.72L159.17 60.42L168.77 60.42M184.51 94.72L174.91 94.72L174.91 60.42L184.51 60.42M205.31 94.72L199.62 94.72Q195.39 94.72 193.02 92.64Q190.66 90.56 190.66 85.76L190.66 49.28L200.26 49.28L200.26 84.74Q200.26 86.27 200.96 86.91Q201.66 87.55 203.01 87.55L205.31 87.55M218.05 94.72L208.45 94.72L208.45 60.42L218.05 60.42";
const LETTER_X: [number, number][] = [[131.33, 155.46], [159.17, 168.77], [174.91, 184.51], [190.66, 205.31], [208.45, 218.05]];
const DOTS = [157.22, 172.96, 206.5].map((x) => ({ x, y: 46.4, w: 11.2, h: 6.08 }));
const WORD = { x0: 131.33, x1: 218.05, y0: 46.4, y1: 94.72, base: 94.72, xh: 60.42 };
const GLITCH = "░▒▓█▀▄▌▐<>/\\|_=+*#01tiliTIL{}[]";

/** The timeline, in timeline seconds; `PACE` turns real seconds into these. */
export const TIMELINE = {
  cursorIn: 0.1,
  scramble: (i: number) => 0.22 + i * 0.06,
  lock: (i: number) => 0.48 + i * 0.085,
  dot: (k: number) => 0.9 + k * 0.07,
  dotFall: 0.14,
  sweepA: [1.0, 1.4] as const,
  focus: 1.12,
  fall: 0.16,
  settle: 0.14,
  wall: 1.22,
  wallSpread: 0.85,
  hint: 1.3,
  chevron: 1.55,
  underscore: 1.66,
  sweepB: [2.05, 2.6] as const,
  dive: 2.75,
  diveDur: 0.55,
  fade: 0.22,
  get end() { return this.dive + this.diveDur + this.fade; },
};
/** Timeline seconds per real second: the splash plays at half the timeline's speed, about seven seconds in all. */
export const PACE = 0.5;
/** The pace once skipped: the dive still plays, quickly. */
export const SKIP_PACE = 1.4;
/** How long the reduced-motion splash shows the finished lockup, and how long it fades, in real seconds. */
const STILL = { hold: 0.9, fade: 0.3 };

// ---- once a day ----
/** The local calendar day of `now` as YYYY-MM-DD. */
export function localDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Whether the splash is due: unless it already started today, whatever is stored (nothing, an earlier day, garbage). */
export function splashDue(lastShown: string | null, now: Date): boolean {
  return lastShown !== localDay(now);
}

// ---- helpers ----
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOutCubic = (k: number) => 1 - (1 - k) ** 3;
const easeInCubic = (k: number) => k * k * k;
const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const easeOutBack = (k: number) => 1 + 2.9 * (k - 1) ** 3 + 1.9 * (k - 1) ** 2;
const smooth = (a: number, b: number, v: number) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };

/** A CSS colour as `#rrggbb`: hex (3 or 6 digits) and `rgb()` are understood; anything else is `fallback`. */
export function toHex(value: string, fallback: string): string {
  const v = value.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v);
  if (rgb) return "#" + rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  return fallback;
}
const rgbOf = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function mix(a: string, b: string, k: number): string {
  const x = rgbOf(a), y = rgbOf(b);
  return "#" + x.map((v, i) => Math.round(lerp(v, y[i], k)).toString(16).padStart(2, "0")).join("");
}
const rgba = (h: string, a: number) => { const [r, g, b] = rgbOf(h); return `rgba(${r},${g},${b},${a})`; };
/** Whether a ground is light: its relative luminance is over one half. */
export function isLight(hex: string): boolean {
  const [r, g, b] = rgbOf(hex).map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DIR = [0.944, 0.33];
const proj = (x: number, y: number) => x * DIR[0] + y * DIR[1];

interface Palette { bg: string; fg: string; muted: string; termBg: string; accent: string; light: boolean }

/** The splash's colours from the applied theme's tokens; Koski's where a token can't be read. */
function readPalette(root: HTMLElement): Palette {
  const css = getComputedStyle(root);
  const token = (name: string, fallback: string) => toHex(css.getPropertyValue(name), fallback);
  const bg = token("--bg", "#0f1516");
  return {
    bg,
    fg: token("--fg", "#c9cfcd"),
    muted: token("--muted", "#8a9492"),
    termBg: token("--term-bg", "#182023"),
    accent: token("--accent", "#c9764f"),
    light: isLight(bg),
  };
}

interface Brick { x: number; y: number; d: number; focus: boolean; color: string; jitter: number; dir: number; delay: number; alpha: number }
interface Layout {
  s: number; ox: number; oy: number; bw: number; bh: number; bricks: Brick[]; focus: Brick;
  x0: number; x1: number; y0: number; y1: number; fx: number; fy: number; zEnd: number;
}
interface Dust { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number }
interface Pose { dy: number; sx: number; sy: number; a: number }

export interface SplashOptions {
  /** The element the `>_` lands in: the first terminal's screen, once it exists. */
  target: () => Element | null;
  /** The terminal font size, so the landed `>_` matches the prompt. */
  fontSize: number;
  /** The "tiili no-splash" hint was chosen: turn the splash off in the settings. */
  onDisable: () => Promise<void>;
  /** Show the finished lockup and fade, without motion. */
  reducedMotion?: boolean;
}

export interface Splash {
  /** Resolves once the splash has gone. */
  readonly done: Promise<void>;
  /** Jumps to the dive. */
  skip(): void;
}

/** Plays the startup splash over the whole window; keys and clicks skip it and never reach the terminal. */
export function playSplash(options: SplashOptions): Splash {
  const TL = TIMELINE;
  const overlay = document.createElement("div");
  overlay.className = "splash";
  const canvas = document.createElement("canvas");
  const hint = document.createElement("button");
  hint.type = "button";
  hint.className = "splash-hint";
  hint.textContent = "tiili no-splash";
  hint.title = "Don't show this splash again (Settings → Behaviour)";
  overlay.append(canvas, hint);
  overlay.setAttribute("aria-hidden", "true");
  document.body.append(overlay);

  const ctx = canvas.getContext("2d");
  const p = readPalette(document.documentElement);
  overlay.style.setProperty("--splash-bg", p.bg);
  overlay.style.setProperty("--splash-muted", p.muted);
  overlay.style.setProperty("--splash-fg", p.fg);

  let W = 0, H = 0, dpr = 1;
  let L: Layout | null = null;
  let dust: Dust[] = [];

  const layout = () => {
    W = overlay.clientWidth || window.innerWidth;
    H = overlay.clientHeight || window.innerHeight;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    let s = clamp(W * 0.3, 120, 400) / 86.72;
    if (48.32 * s > H * 0.22) s = (H * 0.22) / 48.32;
    const bw = s * 21, bh = (bw * 12) / 25, g = (bw * 2) / 25;
    const px = g + bw * 0.3, py = g + bh * 0.45;
    const wordH = (WORD.y1 - WORD.y0) * s;
    const top = H / 2 - (wordH + py + bh) / 2;
    const ox = W / 2 - ((WORD.x0 + WORD.x1) / 2) * s, oy = top - WORD.y0 * s;
    const x0 = ox + WORD.x0 * s, x1 = ox + WORD.x1 * s, y0 = top, y1 = top + wordH;
    const clear = [x0 - px, y0 - py, x1 + px, y1 + py];
    const baseY = y1 + py, cx = W / 2, cy = (y0 + y1) / 2;
    const pX = bw + g, pY = bh + g;

    const bricks: Brick[] = [];
    const rMin = -Math.ceil((baseY + bh) / pY) - 1, rMax = Math.ceil((H - baseY) / pY) + 1;
    const n = Math.ceil(W / 2 / pX) + 2;
    let dMax = 0;
    for (let row = rMin; row <= rMax; row++) {
      const off = ((row % 2) + 2) % 2 ? pX / 2 : 0;
      const y = baseY + row * pY;
      for (let c = -n; c <= n; c++) {
        const x = cx - bw / 2 + c * pX + off;
        if (x + bw < -2 || x > W + 2 || y + bh < -2 || y > H + 2) continue;
        if (x < clear[2] && x + bw > clear[0] && y < clear[3] - 0.5 && y + bh > clear[1]) continue;
        const rand = rng((row + 1000) * 7919 + (c + 1000) * 104729);
        const d = Math.hypot((x + bw / 2 - cx) / W, ((y + bh / 2 - cy) / H) * 1.25);
        dMax = Math.max(dMax, d);
        const base = rand() < 0.22 ? BRICK.klinkkeri : BRICK.tiili;
        let color = mix(base, BRICK.savi, rand() * (p.light ? 0.28 : 0.16));
        if (!p.light) color = mix(color, p.bg, 0.12 + rand() * 0.16);
        bricks.push({ x, y, d, focus: row === 0 && c === 0, color, jitter: rand() - 0.5, dir: row % 2 ? 1 : -1, delay: 0, alpha: 1 });
      }
    }
    const vignette = Math.hypot(0.5, 0.625);
    for (const b of bricks) {
      // Alternate courses are laid leftward and rightward, like a bricklayer working along the line.
      const side = Math.sign(b.x + bw / 2 - cx) === b.dir ? 0.035 : 0;
      b.delay = b.focus ? TL.focus : TL.wall + (b.d / dMax) * TL.wallSpread + side + b.jitter * 0.05;
      b.alpha = b.focus ? 1 : 1 - 0.82 * smooth(0.18, 1.0, b.d / vignette);
    }
    const focus = bricks.find((b) => b.focus) as Brick;
    L = { s, ox, oy, bw, bh, bricks, focus, x0, x1, y0, y1,
      fx: focus.x + bw / 2, fy: focus.y + bh / 2, zEnd: Math.max(W / bw, H / bh) * 1.12 };
  };

  // ---- mortar dust: the only simulated part ----
  const puff = (x: number, y: number, w: number, count: number, power: number) => {
    if (!L) return;
    const k = L.bw / 80;
    for (let i = 0; i < count; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      dust.push({ x: x + w / 2 + side * Math.random() * w * 0.55, y,
        vx: side * (30 + Math.random() * 120) * power * k, vy: -(15 + Math.random() * 70) * power * k,
        life: 0, max: 0.35 + Math.random() * 0.4, size: (1.2 + Math.random() * 1.8) * Math.max(1, k) });
    }
  };
  const spawnBetween = (a: number, b: number) => {
    if (!L || b <= a) return;
    const hit = (ti: number) => ti > a && ti <= b;
    for (const br of L.bricks) {
      if (hit(br.delay + TL.fall)) puff(br.x, br.y + L.bh, L.bw, br.focus ? 18 : Math.round(1 + 4 * br.alpha), br.focus ? 1.5 : 1);
    }
    DOTS.forEach((d, k) => {
      if (L && hit(TL.dot(k) + TL.dotFall)) puff(L.ox + d.x * L.s, L.oy + (d.y + d.h) * L.s, d.w * L.s, 6, 0.6);
    });
  };
  const stepDust = (dt: number) => {
    for (const q of dust) { q.life += dt; q.vy += 260 * dt; q.vx *= 1 - 3 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    dust = dust.filter((q) => q.life < q.max);
  };

  const shake = (t: number): [number, number] => {
    if (!L) return [0, 0];
    let x = 0, y = 0;
    const impacts: [number, number][] = [[TL.focus + TL.fall, 3.2], ...DOTS.map((_, k): [number, number] => [TL.dot(k) + TL.dotFall, 1.1])];
    for (const [ti, amp] of impacts) {
      const e = t - ti;
      if (e <= 0 || e > 0.35) continue;
      const a = amp * (L.s / 4) * Math.exp(-e * 20);
      x += a * Math.sin(e * 83); y += a * Math.cos(e * 61);
    }
    return [x, y];
  };

  const sweepsAt = (t: number) => {
    const out: { p: number; w: number; strength: number }[] = [];
    if (!L) return out;
    const [a0, a1] = TL.sweepA, [b0, b1] = TL.sweepB;
    const wA = L.s * 22, wB = Math.max(W, H) * 0.14;
    if (t > a0 && t < a1) {
      const k = easeInOutCubic((t - a0) / (a1 - a0));
      out.push({ p: lerp(proj(L.x0, L.y0) - wA, proj(L.x1, L.y1) + wA, k), w: wA, strength: 1 });
    }
    if (t > b0 && t < b1) {
      const k = easeInOutCubic((t - b0) / (b1 - b0));
      out.push({ p: lerp(-wB, proj(W, H) + wB, k), w: wB, strength: 0.8 });
    }
    return out;
  };
  const highlight = p.light ? "#ffffff" : "#ffe6d2";
  const focusBrick = p.light ? BRICK.klinkkeri : BRICK.savi;
  const focusGlyph = p.light ? "#ffffff" : BRICK.koski;

  const brickPose = (b: Brick, t: number): Pose | null => {
    if (!L) return null;
    const e = t - b.delay;
    if (e < 0) return null;
    let dy = 0, sx = 1, sy = 1, a = 1;
    if (e < TL.fall) {
      const k = e / TL.fall;
      dy = -(1 - k * k) * L.bh * (b.focus ? 1.6 : 0.9);
      sx = sy = lerp(b.focus ? 1.35 : 1.12, 1, k * k);
      a = clamp(e / 0.07);
    } else if (e < TL.fall + TL.settle) {
      const v = (e - TL.fall) / TL.settle, sq = Math.sin(Math.PI * v) * (1 - v * 0.4) * (b.focus ? 1.6 : 1);
      sy = 1 - 0.11 * sq; sx = 1 + 0.06 * sq;
    }
    return { dy, sx, sy, a };
  };

  const drawBrick = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, pose: Pose, alpha: number) => {
    const cx = x + w / 2, by = y + h, ww = w * pose.sx, hh = h * pose.sy;
    c.globalAlpha = alpha * pose.a;
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(cx - ww / 2, by - hh + pose.dy, ww, hh, Math.max(1, (1.5 / 25) * w));
    c.fill();
    return [cx - ww / 2, by - hh + pose.dy, ww, hh];
  };

  const glowAt = (x: number, y: number, sweeps: ReturnType<typeof sweepsAt>) => {
    let glow = 0;
    const pc = proj(x, y);
    for (const s of sweeps) glow += s.strength * Math.exp(-(((pc - s.p) / s.w) ** 2) * 2.5);
    return glow;
  };

  const drawWall = (c: CanvasRenderingContext2D, l: Layout, t: number, sweeps: ReturnType<typeof sweepsAt>, sceneAlpha: number) => {
    for (const b of l.bricks) {
      if (b.focus) continue;
      const pose = brickPose(b, t);
      if (!pose) continue;
      const r = drawBrick(c, b.x, b.y, l.bw, l.bh, b.color, pose, b.alpha * sceneAlpha);
      let glow = glowAt(b.x + l.bw / 2, b.y + l.bh / 2, sweeps);
      const e = t - b.delay - TL.fall;
      if (e > 0 && e < 0.18) glow += 0.35 * (1 - e / 0.18); // a brick flashes as it lands
      if (glow > 0.01) {
        c.globalAlpha = clamp(glow * 0.42) * b.alpha * sceneAlpha * pose.a;
        c.fillStyle = highlight;
        c.beginPath(); c.roundRect(r[0], r[1], r[2], r[3], Math.max(1, (1.5 / 25) * l.bw)); c.fill();
      }
    }
    c.globalAlpha = 1;
  };

  const letters = WORD_D.split(/(?=M)/).map((d, i) => new Path2D(d + (i ? "Z" : "")));

  const drawWord = (c: CanvasRenderingContext2D, l: Layout, t: number, sweeps: ReturnType<typeof sweepsAt>, sceneAlpha: number) => {
    const { s, ox, oy } = l;
    const fpx = ((WORD.base - 52.35) * s) / 0.72;
    const cellW = fpx * 0.6;
    const slotX = (i: number) => (i < 5 ? ox + ((LETTER_X[i][0] + LETTER_X[i][1]) / 2) * s : ox + 226 * s);
    const baseY = oy + WORD.base * s;
    c.globalAlpha = sceneAlpha;

    c.font = `700 ${fpx}px "Geist Mono", ui-monospace, monospace`;
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    // The cursor runs along like a print head, just ahead of the letters still being decided.
    const head = clamp((t - 0.4) / 0.085, 0, 5);
    const hi0 = Math.floor(head), hf = easeOutCubic(clamp((head - hi0) * 3));
    const curX = lerp(slotX(hi0), slotX(Math.min(5, hi0 + 1)), hi0 >= 5 ? 0 : hf);
    const curW = cellW * 0.92, curH = (WORD.base - WORD.xh) * s;
    const curOut = clamp((t - 0.88) / 0.1);
    const curVisible = t >= TL.cursorIn && curOut < 1 && (t > 0.34 || Math.floor((t - TL.cursorIn) / 0.09) % 2 === 0);
    if (curVisible) {
      c.fillStyle = p.light ? BRICK.tiili : BRICK.savi;
      const h = curH * (1 - easeInCubic(curOut));
      c.beginPath(); c.roundRect(curX - curW / 2, baseY - h, curW, h, 0.9 * s); c.fill();
    }

    letters.forEach((path, i) => {
      const tl = TL.lock(i);
      if (t < tl) {
        if (t < TL.scramble(i)) return;
        const r = rng(Math.floor(t / 0.045) * 31 + i * 977)();
        const under = curVisible && Math.abs(slotX(i) - curX) < curW * 0.5;
        c.fillStyle = under ? p.bg : r < 0.25 ? (p.light ? BRICK.tiili : BRICK.savi) : p.muted;
        c.fillText(GLITCH[Math.floor(r * GLITCH.length)], slotX(i), baseY);
        return;
      }
      // Locked: the letter snaps in, flashing from the highlight to the text colour.
      const k = clamp((t - tl) / 0.2);
      const sc = lerp(1.22, 1, easeOutBack(k));
      const cx = slotX(i);
      c.save();
      c.translate(cx, baseY); c.scale(sc, sc); c.translate(-cx, -baseY);
      c.translate(ox, oy); c.scale(s, s);
      if (k < 1) {
        c.fillStyle = mix(highlight, p.fg, easeOutCubic(clamp((t - tl) / 0.32)));
      } else if (sweeps.length) {
        const sw = sweeps[0];
        const pl = (sw.p - proj(ox, oy)) / s, wl = sw.w / s;
        const gr = c.createLinearGradient(DIR[0] * (pl - wl), DIR[1] * (pl - wl), DIR[0] * (pl + wl), DIR[1] * (pl + wl));
        gr.addColorStop(0, p.fg); gr.addColorStop(0.5, mix(p.fg, highlight, sw.strength)); gr.addColorStop(1, p.fg);
        c.fillStyle = gr;
      } else {
        c.fillStyle = p.fg;
      }
      c.fill(path);
      c.restore();
    });

    // The i's dots: three little bricks slapped on.
    DOTS.forEach((d, k) => {
      const e = t - TL.dot(k);
      if (e < 0) return;
      const pose: Pose = { dy: 0, sx: 1, sy: 1, a: 1 };
      if (e < TL.dotFall) { const q = e / TL.dotFall; pose.dy = -(1 - q * q) * 26 * s; pose.a = clamp(e / 0.05); }
      else if (e < TL.dotFall + 0.12) { const sq = Math.sin((Math.PI * (e - TL.dotFall)) / 0.12); pose.sy = 1 - 0.22 * sq; pose.sx = 1 + 0.12 * sq; }
      drawBrick(c, ox + d.x * s, oy + d.y * s, d.w * s, d.h * s, p.light ? BRICK.tiili : BRICK.savi, pose, sceneAlpha);
    });
    c.globalAlpha = 1;
  };

  const drawGlyph = (c: CanvasRenderingContext2D, t: number, ox: number, oy: number, unit: number, us: number[], color: string, diving: boolean) => {
    if (t < TL.chevron) return;
    const pop = diving ? 1 : lerp(1.45, 1, easeOutBack(clamp((t - TL.chevron) / 0.16)));
    const ccx = ox + 9.9 * unit, ccy = oy + 6 * unit, u = unit * pop;
    c.strokeStyle = color; c.lineWidth = 1.5 * u; c.lineCap = "square"; c.lineJoin = "miter";
    c.beginPath();
    c.moveTo(ccx - 1.8 * u, ccy - 2.7 * u); c.lineTo(ccx + 1.8 * u, ccy); c.lineTo(ccx - 1.8 * u, ccy + 2.7 * u);
    c.stroke();
    if (t < TL.underscore) return;
    if (!diving && t > TL.underscore + 0.12 && Math.floor((t - TL.underscore) / 0.26) % 2 === 1) return;
    c.fillStyle = color;
    c.beginPath(); c.roundRect(us[0], us[1], us[2], us[3], Math.min(1.5, us[3] / 3)); c.fill();
  };

  /** Where the `>_` lands: the first cell of the target terminal, the underscore grown into a block cursor. */
  const landing = () => {
    const rect = options.target()?.getBoundingClientRect();
    const o = overlay.getBoundingClientRect();
    const left = rect && rect.width > 0 ? rect.left - o.left : 12;
    const top = rect && rect.height > 0 ? rect.top - o.top : 40;
    const cellW = options.fontSize * 0.6, cellH = options.fontSize * 1.2;
    const unit = (cellH * 0.42) / 5.4;
    return { ox: left + cellW * 0.5 - 9.9 * unit, oy: top + cellH * 0.5 - 6 * unit, unit, cursor: [left + cellW * 2, top, cellW, cellH] };
  };

  const render = (t: number) => {
    if (!ctx || !L) return;
    const l = L;
    const sweeps = sweepsAt(t);
    const u = clamp((t - TL.dive) / TL.diveDur);
    const diving = t > TL.dive;
    const zu = clamp(u / 0.8);
    const zk = zu < 0.5 ? 2 * zu * zu : 1 - (-2 * zu + 2) ** 2 / 2;
    const z = diving ? Math.exp(Math.log(l.zEnd) * zk ** 1.3) : 1;
    const m = easeInOutCubic(zu);
    const mx = lerp(l.fx, W / 2, m), my = lerp(l.fy, H / 2, m);
    const [shx, shy] = shake(t);
    const camX = mx - l.fx * z + shx, camY = my - l.fy * z + shy;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.setTransform(dpr * z, 0, 0, dpr * z, camX * dpr, camY * dpr);
    const sceneAlpha = 1 - easeInCubic(zu);
    drawWall(ctx, l, t, sweeps, sceneAlpha);
    const dustColor = p.light ? BRICK.graniitti : BRICK.laasti;
    for (const q of dust) {
      ctx.fillStyle = rgba(dustColor, (1 - q.life / q.max) * 0.55 * sceneAlpha);
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    drawWord(ctx, l, t, sweeps, sceneAlpha);

    const f = l.focus, pose = brickPose(f, t);
    if (!pose) return;
    const unit = l.bw / 25;
    if (!diving) {
      const r = drawBrick(ctx, f.x, f.y, l.bw, l.bh, focusBrick, pose, 1);
      const e = t - f.delay - TL.fall;
      const glow = glowAt(l.fx, l.fy, sweeps) * 0.35 + (e > 0 && e < 0.22 ? 0.55 * (1 - e / 0.22) : 0);
      if (glow > 0.01) {
        ctx.globalAlpha = clamp(glow); ctx.fillStyle = highlight;
        ctx.beginPath(); ctx.roundRect(r[0], r[1], r[2], r[3], 1.5 * unit); ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawGlyph(ctx, t, f.x, f.y, unit, [f.x + 13.1 * unit, f.y + 8 * unit, 4.8 * unit, 1.5 * unit], focusGlyph, false);
      return;
    }

    // The dive: the focus brick fills the window and becomes the terminal's ground.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = camX + f.x * z, sy = camY + f.y * z;
    ctx.fillStyle = mix(focusBrick, p.termBg, smooth(0.45, 0.85, u));
    ctx.beginPath(); ctx.roundRect(sx, sy, l.bw * z, l.bh * z, Math.min(1.5 * unit * z, 28) * (1 - u)); ctx.fill();
    // The >_ rides the growing brick (capped in size), then settles into the prompt once the brick fills the window.
    const end = landing();
    const k = easeInOutCubic(smooth(0.62, 1, u));
    const uS = unit * Math.min(z, 2.4);
    const startX = sx + 13 * unit * z - 13 * uS, startY = sy + 6 * unit * z - 6 * uS;
    const us0 = [startX + 13.1 * uS, startY + 8 * uS, 4.8 * uS, 1.5 * uS];
    const us = us0.map((v, i) => lerp(v, end.cursor[i], k));
    const color = mix(focusGlyph, p.accent, smooth(0.2, 0.8, u));
    drawGlyph(ctx, t, lerp(startX, end.ox, k), lerp(startY, end.oy, k), lerp(uS, end.unit, k), us, color, true);
  };

  // ---- clock ----
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((r) => (resolveDone = r));
  let base = 0; // timeline time at `since`
  let since = performance.now();
  let pace = PACE;
  let last = 0;
  let raf = 0;
  let finished = false;
  const timeline = () => base + ((performance.now() - since) / 1000) * pace;
  const elapsed = () => (performance.now() - since) / 1000;

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    window.removeEventListener("keydown", onKey, true);
    overlay.remove();
    resolveDone();
  };

  const frame = () => {
    if (options.reducedMotion) {
      const e = elapsed();
      render(TL.dive - 0.01);
      canvas.style.opacity = String(1 - clamp((e - STILL.hold) / STILL.fade));
      if (e >= STILL.hold + STILL.fade) return finish();
      raf = requestAnimationFrame(frame);
      return;
    }
    const t = timeline();
    spawnBetween(last, t);
    stepDust(Math.min(0.05, Math.max(0, t - last)));
    last = t;
    render(Math.min(t, TL.dive + TL.diveDur));
    overlay.style.opacity = String(1 - clamp((t - TL.dive - TL.diveDur) / TL.fade));
    overlay.classList.toggle("splash-hinted", t >= TL.hint && t < TL.dive);
    if (t >= TL.end) return finish();
    raf = requestAnimationFrame(frame);
  };

  const skip = () => {
    if (finished) return;
    if (options.reducedMotion) {
      since = performance.now() - STILL.hold * 1000;
      return;
    }
    const t = timeline();
    if (t >= TL.dive) return;
    dust = [];
    last = TL.dive;
    base = TL.dive;
    since = performance.now();
    pace = SKIP_PACE;
  };

  const onKey = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    skip();
  };
  window.addEventListener("keydown", onKey, true);
  overlay.addEventListener("pointerdown", (event) => {
    if (event.target === hint) return;
    event.preventDefault();
    skip();
  });
  hint.addEventListener("click", () => {
    hint.textContent = "splash off · turn it back on in Settings";
    hint.disabled = true;
    options.onDisable().catch(() => {
      hint.textContent = "couldn't save: turn it off in Settings";
    });
    setTimeout(skip, 700);
  });

  const observer = new ResizeObserver(() => layout());
  observer.observe(overlay);
  layout();
  // The ground shows at once; the motion waits (briefly) for Geist Mono, so the scramble isn't in a fallback font.
  if (ctx) { ctx.fillStyle = p.bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  const font = document.fonts?.load('700 40px "Geist Mono"') ?? Promise.resolve();
  void Promise.race([font, new Promise((r) => setTimeout(r, 250))]).finally(() => {
    if (finished) return;
    since = performance.now();
    raf = requestAnimationFrame(frame);
  });
  return { done, skip };
}
