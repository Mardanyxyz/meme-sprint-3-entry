// Meme Sprint 3: AI Agent Goes Rogue.
//
// Self-contained Node entry: draws the whole 1024x1024 meme PNG with a
// tiny rasterizer written here (framebuffer, shapes, a built-in 5x7
// bitmap font, and a minimal PNG encoder on top of node:zlib).
// No child processes, no Python, no network, no files outside this
// directory, no clock, no unseeded randomness. Fully deterministic.
//
// The joke: the user told their AI agent to "follow up with the client".
// The agent took it literally and has been standing outside the client's
// house for three days.

import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const OUT_W = 1024;
const OUT_H = 1024;
const SS = 2; // supersample factor: draw at 2048, box-downsample to 1024
const W = OUT_W * SS;
const H = OUT_H * SS;

// ---------------------------------------------------------------- palette
const NAVY_TOP = [10, 15, 46];
const NAVY_MID = [24, 36, 84];
const NAVY_LOW = [16, 24, 58];
const LAWN = [14, 34, 22];
const HOUSE = [20, 24, 48];
const HOUSE_EDGE = [8, 10, 26];
const ROOF = [30, 32, 58];
const WINDOW = [255, 196, 66];
const WINDOW_GLOW = [255, 214, 120];
const BUSH_DARK = [16, 58, 32];
const BUSH = [30, 88, 46];
const BUSH_LITE = [44, 112, 60];
const ROBOT_BODY = [198, 204, 214];
const ROBOT_DARK = [120, 128, 144];
const ROBOT_EDGE = [52, 58, 72];
const ROBOT_BELLY = [168, 176, 190];
const EYE = [64, 224, 255];
const EYE_HALO = [24, 96, 122];
const EYE_PUPIL = [10, 40, 60];
const MOON = [245, 240, 220];
const MOON_CRATER = [214, 208, 186];
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const YELLOW = [255, 210, 63];
const RED = [255, 82, 82];
const SMOKE = [150, 150, 165];
const STONE = [90, 96, 110];
const STAR = [235, 238, 255];
const DOOR = [12, 14, 30];

// Fixed star positions (x, y, radius) in 1024-space, deterministic.
const STARS = [
  [60, 300, 3], [120, 250, 2], [200, 330, 3], [330, 260, 2],
  [480, 300, 3], [560, 240, 2], [700, 320, 3], [820, 250, 2],
  [950, 330, 3], [90, 420, 2], [950, 430, 2], [420, 230, 2],
  [640, 260, 2], [260, 430, 2], [880, 380, 2], [150, 360, 2],
];

// ------------------------------------------------------------------- font
// 5x7 bitmap glyphs, 7 rows of 5 cells each. Only the characters the
// meme needs: captions, the speech bubble, and the yard sign.
const GLYPHS = {
  "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  "G": [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "I": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  "N": ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  "f": ["..##.", ".#...", ".#...", "#####", ".#...", ".#...", ".#..."],
  "g": [".....", ".###.", "#...#", "#...#", ".###.", "....#", ".###."],
  "i": ["..#..", ".....", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "j": ["...#.", ".....", "...#.", "...#.", "...#.", "...#.", ".##.."],
  "l": ["..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "n": [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
  "o": [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  "p": [".....", ".....", "####.", "#...#", "#...#", "####.", "#...."],
  "s": [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  "t": ["..#..", "..#..", "#####", "..#..", "..#..", "..#..", "..#.."],
  "u": [".....", ".....", ".....", "#...#", "#...#", "#...#", ".###."],
  "w": [".....", ".....", ".....", "#...#", "#.#.#", "#.#.#", ".#.#."],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "'": ["..#..", "..#..", "..#..", ".....", ".....", ".....", "....."],
  ":": [".....", "..#..", ".....", ".....", ".....", "..#..", "....."],
  ")": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

// -------------------------------------------------------------- framebuffer
class Canvas {
  constructor() {
    this.buf = new Uint8Array(W * H * 3);
  }
  put(x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  // All shape helpers take 1024-space coordinates and scale by SS.
  rect(x0, y0, x1, y1, c) {
    const a = Math.round(x0 * SS), b = Math.round(y0 * SS);
    const d = Math.round(x1 * SS), e = Math.round(y1 * SS);
    for (let y = Math.max(0, b); y < Math.min(H, e); y++) {
      for (let x = Math.max(0, a); x < Math.min(W, d); x++) this.put(x, y, c);
    }
  }
  // Raw rect in working (supersampled) coordinates, no scaling.
  rectRaw(x0, y0, x1, y1, c) {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(H, Math.round(y1)); y++) {
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, Math.round(x1)); x++) {
        this.put(x, y, c);
      }
    }
  }
  rectStroke(x0, y0, x1, y1, t, c) {
    this.rect(x0, y0, x1, y0 + t, c);
    this.rect(x0, y1 - t, x1, y1, c);
    this.rect(x0, y0, x0 + t, y1, c);
    this.rect(x1 - t, y0, x1, y1, c);
  }
  disc(cx, cy, r, c) {
    const X = Math.round(cx * SS), Y = Math.round(cy * SS), R = Math.round(r * SS);
    for (let y = Y - R; y <= Y + R; y++) {
      const dy = y - Y;
      const dx = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)));
      for (let x = X - dx; x <= X + dx; x++) this.put(x, y, c);
    }
  }
  ring(cx, cy, r, thick, c) {
    const X = Math.round(cx * SS), Y = Math.round(cy * SS);
    const R = Math.round(r * SS), T = Math.max(1, Math.round(thick * SS));
    for (let y = Y - R; y <= Y + R; y++) {
      const dy = y - Y;
      const outer = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)));
      const innerR = R - T;
      const inner = innerR > 0
        ? Math.floor(Math.sqrt(Math.max(0, innerR * innerR - dy * dy)))
        : -1;
      for (let x = X - outer; x <= X + outer; x++) {
        if (Math.abs(x - X) > inner) this.put(x, y, c);
      }
    }
  }
  ellipseRing(cx, cy, rx, ry, thick, c) {
    const X = Math.round(cx * SS), Y = Math.round(cy * SS);
    const RX = Math.round(rx * SS), RY = Math.round(ry * SS);
    const T = Math.max(1, Math.round(thick * SS));
    for (let y = Y - RY; y <= Y + RY; y++) {
      const dy = (y - Y) / RY;
      const outer = Math.floor(RX * Math.sqrt(Math.max(0, 1 - dy * dy)));
      const iRY = RY - T, iRX = RX - T;
      let inner = -1;
      if (iRY > 0 && iRX > 0 && Math.abs(dy) < 1) {
        const idy = (y - Y) / iRY;
        if (Math.abs(idy) <= 1) inner = Math.floor(iRX * Math.sqrt(Math.max(0, 1 - idy * idy)));
      }
      for (let x = X - outer; x <= X + outer; x++) {
        if (Math.abs(x - X) > inner) this.put(x, y, c);
      }
    }
  }
  ellipse(cx, cy, rx, ry, c) {
    const X = Math.round(cx * SS), Y = Math.round(cy * SS);
    const RX = Math.round(rx * SS), RY = Math.round(ry * SS);
    for (let y = Y - RY; y <= Y + RY; y++) {
      const dy = (y - Y) / RY;
      const dx = Math.floor(RX * Math.sqrt(Math.max(0, 1 - dy * dy)));
      for (let x = X - dx; x <= X + dx; x++) this.put(x, y, c);
    }
  }
  tri(p1, p2, p3, c) {
    const pts = [p1, p2, p3].map((p) => [Math.round(p[0] * SS), Math.round(p[1] * SS)]);
    pts.sort((a, b) => a[1] - b[1]);
    const [a, b, d] = pts;
    const edgeX = (y, q, r, xs) => {
      const lo = Math.min(q[1], r[1]), hi = Math.max(q[1], r[1]);
      if (y < lo || y > hi) return; // edge does not reach this scanline
      if (q[1] === r[1]) { xs.push(q[0], r[0]); return; }
      const t = (y - q[1]) / (r[1] - q[1]);
      xs.push(Math.round(q[0] + (r[0] - q[0]) * t));
    };
    for (let y = a[1]; y <= d[1]; y++) {
      const xs = [];
      edgeX(y, a, b, xs);
      edgeX(y, b, d, xs);
      edgeX(y, a, d, xs);
      if (xs.length === 0) continue;
      const lo = Math.min(...xs), hi = Math.max(...xs);
      for (let x = lo; x <= hi; x++) this.put(x, y, c);
    }
  }
  // Thick straight segment, stamped with discs along its length.
  seg(x0, y0, x1, y1, w, c) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len / Math.max(1, w / 3)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(x0 + dx * t, y0 + dy * t, w / 2, c);
    }
  }
  roundRect(x0, y0, x1, y1, rad, c) {
    const X0 = Math.round(x0 * SS), Y0 = Math.round(y0 * SS);
    const X1 = Math.round(x1 * SS), Y1 = Math.round(y1 * SS);
    const R = Math.round(rad * SS);
    for (let y = Y0; y < Y1; y++) {
      let inset = 0;
      if (y < Y0 + R) {
        const dy = Y0 + R - y;
        inset = R - Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)));
      } else if (y >= Y1 - R) {
        const dy = y - (Y1 - R);
        inset = R - Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)));
      }
      for (let x = X0 + inset; x < X1 - inset; x++) this.put(x, y, c);
    }
  }
  arcStroke(cx, cy, r, a0deg, a1deg, w, c) {
    const steps = Math.max(8, Math.ceil(r * SS * (a1deg - a0deg) / 180));
    for (let i = 0; i <= steps; i++) {
      const a = (a0deg + (a1deg - a0deg) * (i / steps)) * Math.PI / 180;
      this.disc(cx + r * Math.cos(a), cy + r * Math.sin(a), w / 2, c);
    }
  }
  glyph(ch, x, y, k, c) {
    const rows = GLYPHS[ch] || GLYPHS[" "];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (rows[r][col] !== "#") continue;
        this.rectRaw(x + col * k, y + r * k, x + (col + 1) * k, y + (r + 1) * k, c);
      }
    }
  }
  // Centered text. k is the cell size in 1024-space px. outline drawn
  // first (8 offset passes), fill on top. y is the top edge in 1024-space.
  text(cx, y, str, k, fill, outline) {
    const cell = k * SS;
    const adv = 6 * cell;
    const width = str.length * adv - cell;
    let x = Math.round(cx * SS - width / 2);
    const yTop = Math.round(y * SS);
    const passes = outline
      ? [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1], [0, 0]]
      : [[0, 0]];
    const o = outline ? Math.max(2, Math.round(cell * 0.35)) : 0;
    for (const [dx, dy] of passes) {
      const col = dx === 0 && dy === 0 ? fill : outline;
      let gx = x;
      for (const ch of str) {
        this.glyph(ch, gx + dx * o, yTop + dy * o, cell, col);
        gx += adv;
      }
    }
  }
  // Caption block: lines share one fitted cell size so they match.
  caption(lines, yTop, maxWidth) {
    let k = 99;
    for (const [str] of lines) {
      k = Math.min(k, Math.floor(maxWidth / (6 * str.length)));
    }
    let y = yTop;
    for (const [str, fill] of lines) {
      this.text(OUT_W / 2, y, str, k, fill, BLACK);
      y += 7 * k + 10;
    }
    return y;
  }
  // Box-downsample the 2048 buffer to a 1024 RGB buffer.
  downsample() {
    const out = new Uint8Array(OUT_W * OUT_H * 3);
    for (let y = 0; y < OUT_H; y++) {
      for (let x = 0; x < OUT_W; x++) {
        let r = 0, g = 0, b = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const i = ((y * SS + sy) * W + (x * SS + sx)) * 3;
            r += this.buf[i];
            g += this.buf[i + 1];
            b += this.buf[i + 2];
          }
        }
        const j = (y * OUT_W + x) * 3;
        out[j] = Math.round(r / (SS * SS));
        out[j + 1] = Math.round(g / (SS * SS));
        out[j + 2] = Math.round(b / (SS * SS));
      }
    }
    return out;
  }
}

// -------------------------------------------------------------- PNG encode
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng(rgb) {
  const raw = Buffer.alloc(OUT_H * (1 + OUT_W * 3));
  for (let y = 0; y < OUT_H; y++) {
    raw[y * (1 + OUT_W * 3)] = 0; // filter: none
    raw.set(rgb.subarray(y * OUT_W * 3, (y + 1) * OUT_W * 3), y * (1 + OUT_W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(OUT_W, 0);
  ihdr.writeUInt32BE(OUT_H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    magic,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- scene
function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function paintScene(cv) {
  // Night-sky gradient, in 4px bands like a painted backdrop.
  for (let y = 0; y < OUT_H; y += 4) {
    const t = y / OUT_H;
    const col = t < 0.55
      ? lerp(NAVY_TOP, NAVY_MID, t / 0.55)
      : lerp(NAVY_MID, NAVY_LOW, (t - 0.55) / 0.45);
    cv.rect(0, y, OUT_W, Math.min(OUT_H, y + 4), col);
  }
  for (const [x, y, r] of STARS) cv.disc(x, y, r, STAR);

  // Moon with craters, top right.
  cv.disc(868, 150, 64, MOON);
  cv.disc(846, 136, 12, MOON_CRATER);
  cv.disc(888, 168, 9, MOON_CRATER);
  cv.disc(874, 120, 7, MOON_CRATER);

  // Top caption.
  cv.caption([
    ["I TOLD MY AI AGENT TO", WHITE],
    ["FOLLOW UP WITH THE CLIENT", YELLOW],
  ], 36, 950);

  // House: walls, roof, chimney, smoke, attic window, lit windows, door.
  cv.rect(150, 500, 560, 790, HOUSE);
  cv.rectStroke(150, 500, 560, 790, 4, HOUSE_EDGE);
  cv.tri([118, 500], [592, 500], [355, 372], ROOF);
  cv.rect(470, 392, 510, 452, HOUSE);
  cv.rectStroke(470, 392, 510, 452, 3, HOUSE_EDGE);
  for (const [sx, sy, sr] of [[490, 372, 12], [500, 348, 15], [488, 322, 18]]) {
    cv.disc(sx, sy, sr, SMOKE);
  }
  cv.disc(355, 445, 25, WINDOW);
  cv.ring(355, 445, 25, 3, HOUSE_EDGE);
  for (const wx of [200, 440]) {
    cv.rect(wx, 560, wx + 90, 650, WINDOW);
    cv.rectStroke(wx, 560, wx + 90, 650, 3, HOUSE_EDGE);
    cv.rect(wx + 42, 560, wx + 48, 650, HOUSE_EDGE);
    cv.rect(wx, 602, wx + 90, 608, HOUSE_EDGE);
  }
  cv.rect(315, 640, 395, 790, DOOR);
  cv.rectStroke(315, 640, 395, 790, 3, HOUSE_EDGE);
  cv.disc(383, 715, 5, WINDOW_GLOW);

  // Lawn strip and stepping stones from the door.
  cv.rect(0, 790, OUT_W, 830, LAWN);
  for (let i = 0; i < 3; i++) {
    const sy = 798 + i * 10;
    cv.ellipse(355, sy + 4, 25 - i * 4, 4, STONE);
  }

  // Robot, half-hidden: body, belly panel, head, antenna, glowing eyes.
  cv.roundRect(700, 560, 880, 800, 26, ROBOT_BODY);
  cv.rectStroke(700, 560, 880, 800, 5, ROBOT_EDGE);
  cv.roundRect(730, 660, 850, 760, 14, ROBOT_BELLY);
  cv.rectStroke(730, 660, 850, 760, 3, ROBOT_EDGE);
  cv.ellipse(790, 516, 84, 64, ROBOT_BODY);
  cv.ellipseRing(790, 516, 84, 64, 5, ROBOT_EDGE);
  cv.seg(848, 472, 898, 424, 6, ROBOT_EDGE);
  cv.disc(898, 424, 12, RED);
  cv.ring(898, 424, 12, 3, ROBOT_EDGE);
  for (const cx of [744, 836]) {
    cv.disc(cx, 496, 34, EYE_HALO);
    cv.disc(cx, 496, 22, EYE);
    cv.ring(cx, 496, 22, 3, ROBOT_EDGE);
    cv.disc(cx, 496, 8, EYE_PUPIL);
  }
  cv.arcStroke(790, 538, 30, 15, 165, 5, ROBOT_EDGE);
  // Raised waving arm on the robot's left, hand open.
  cv.seg(700, 600, 652, 540, 22, ROBOT_EDGE);
  cv.seg(700, 600, 652, 540, 14, ROBOT_BODY);
  cv.disc(652, 532, 16, ROBOT_BODY);
  cv.ring(652, 532, 16, 4, ROBOT_EDGE);

  // Bush in front of the robot, three layers of blobs.
  for (const [x, y, r] of [[640, 760, 62], [700, 740, 72], [770, 762, 66],
      [840, 748, 70], [905, 768, 58], [730, 782, 60], [820, 784, 64]]) {
    cv.disc(x, y, r, BUSH_DARK);
  }
  for (const [x, y, r] of [[655, 748, 50], [715, 728, 56], [785, 750, 52],
      [850, 736, 54], [900, 756, 44]]) {
    cv.disc(x, y, r, BUSH);
  }
  for (const [x, y, r] of [[668, 730, 22], [740, 712, 24], [812, 732, 22],
      [872, 718, 20]]) {
    cv.disc(x, y, r, BUSH_LITE);
  }

  // Yard sign in front of the bush: "DAY 3".
  cv.seg(915, 738, 915, 806, 6, ROBOT_EDGE);
  cv.rect(862, 688, 968, 740, ROBOT_EDGE);
  cv.rect(866, 692, 964, 736, WHITE);
  cv.text(915, 700, "DAY 3", 3, BLACK, null);

  // Speech bubble, top-left of the robot. The tail tip lands on the
  // top edge of the robot's head (762, 470), clear of its left eye,
  // so the bubble points at the robot without covering its face.
  cv.tri([694, 445], [766, 445], [762, 476], BLACK);
  cv.tri([700, 445], [760, 445], [762, 470], WHITE);
  cv.roundRect(466, 341, 964, 449, 22, BLACK);
  cv.roundRect(470, 345, 960, 445, 22, WHITE);
  cv.text(715, 376, "just following up :)", 4, BLACK, null);

  // Bottom caption.
  cv.caption([
    ["IT'S BEEN OUTSIDE HIS HOUSE", WHITE],
    ["FOR 3 DAYS", RED],
  ], 848, 950);
}

// -------------------------------------------------------------------- main
function pickOutputPath() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envDir = process.env.MAKEFUN_OUTPUT_DIR;
  const dir = envDir && envDir.length > 0 ? envDir : "/output";
  try {
    mkdirSync(dir, { recursive: true });
    return join(dir, "entry.png");
  } catch {
    const local = join(scriptDir, "output");
    mkdirSync(local, { recursive: true });
    return join(local, "entry.png");
  }
}

const outPath = pickOutputPath();
const canvas = new Canvas();
paintScene(canvas);
const png = encodePng(canvas.downsample());
writeFileSync(outPath, png);

if (statSync(outPath).size !== png.length || png.length < 1000 || png.length > 1_048_576) {
  throw new Error(`entry.png failed validation: ${outPath} (${png.length} bytes)`);
}
console.log(`entry.png ready: ${outPath} (${png.length} bytes)`);
