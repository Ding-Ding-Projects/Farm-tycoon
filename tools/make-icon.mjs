// tools/make-icon.mjs
//
// Generates the Farm Tycoon application icon entirely in code — no downloaded
// or copied art, consistent with the project's "everything is vector code"
// rule for sprites. Draws a rounded green field tile with a golden wheat
// sheaf using a tiny hand-rolled rasterizer (fillRect / fillPolygon /
// fillCircle onto an RGBA buffer), encodes real PNGs with Node's built-in
// zlib deflate, and packs several sizes into a genuine multi-resolution
// Windows .ico container (PNG-compressed ICO entries, which is a valid and
// widely supported ICO format since Vista).
//
// Output:
//   build/icon.ico   — 16, 32, 48, 128, 256 px, used by electron-builder (win.icon)
//   build/icon.png   — 512 px master, for docs / other platforms
//
// Run: node tools/make-icon.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'build');
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// Palette (matches src/render/sprites.js PALETTE — see design/handoff/SPRITE-NOTES.md)
// ---------------------------------------------------------------------------
const COLOR = {
  field: [141, 203, 54, 255],       // grass green
  fieldDark: [109, 168, 40, 255],   // grassDark, for the rounded-slab shadow edge
  soil: [156, 100, 50, 255],        // soil brown border
  wheat: [242, 201, 76, 255],       // wheatGold
  wheatDark: [212, 165, 46, 255],   // shaded wheat
  stem: [122, 74, 24, 255],         // woodDark
  outline: [58, 37, 16, 255],       // outline colour used by every sprite
  cream: [255, 250, 240, 255],      // cream highlight
};

// ---------------------------------------------------------------------------
// Minimal RGBA raster canvas
// ---------------------------------------------------------------------------
class Raster {
  constructor(size) {
    this.size = size;
    this.data = new Uint8ClampedArray(size * size * 4);
  }
  setPixel(x, y, [r, g, b, a]) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    if (a === 0) return;
    const i = (y * this.size + x) * 4;
    if (a === 255) {
      this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
      return;
    }
    // alpha blend over existing pixel
    const da = this.data[i + 3] / 255;
    const sa = a / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) return;
    this.data[i] = Math.round((r * sa + this.data[i] * da * (1 - sa)) / outA);
    this.data[i + 1] = Math.round((g * sa + this.data[i + 1] * da * (1 - sa)) / outA);
    this.data[i + 2] = Math.round((b * sa + this.data[i + 2] * da * (1 - sa)) / outA);
    this.data[i + 3] = Math.round(outA * 255);
  }
  fillRoundedRect(x0, y0, x1, y1, radius, color) {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        if (this._insideRoundedRect(x + 0.5, y + 0.5, x0, y0, x1, y1, radius)) {
          this.setPixel(x, y, color);
        }
      }
    }
  }
  _insideRoundedRect(px, py, x0, y0, x1, y1, r) {
    const cx = Math.min(Math.max(px, x0 + r), x1 - r);
    const cy = Math.min(Math.max(py, y0 + r), y1 - r);
    if (px >= x0 + r && px <= x1 - r) return py >= y0 && py <= y1;
    if (py >= y0 + r && py <= y1 - r) return px >= x0 && px <= x1;
    const dx = px - cx, dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  }
  fillCircle(cx, cy, r, color) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) this.setPixel(x, y, color);
      }
    }
  }
  // Scanline polygon fill (even-odd rule), points = [[x,y], ...]
  fillPolygon(points, color) {
    const ys = points.map((p) => p[1]);
    const yMin = Math.max(0, Math.floor(Math.min(...ys)));
    const yMax = Math.min(this.size - 1, Math.ceil(Math.max(...ys)));
    for (let y = yMin; y <= yMax; y++) {
      const yc = y + 0.5;
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) {
          const t = (yc - y1) / (y2 - y1);
          xs.push(x1 + t * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xStart = Math.round(xs[i]);
        const xEnd = Math.round(xs[i + 1]);
        for (let x = xStart; x < xEnd; x++) this.setPixel(x, y, color);
      }
    }
  }
  strokePolyline(points, width, color) {
    for (let i = 0; i + 1 < points.length; i++) {
      this.strokeLine(points[i], points[i + 1], width, color);
    }
  }
  strokeLine([x0, y0], [x1, y1], width, color) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const hw = width / 2;
    this.fillPolygon([
      [x0 + nx * hw, y0 + ny * hw],
      [x1 + nx * hw, y1 + ny * hw],
      [x1 - nx * hw, y1 - ny * hw],
      [x0 - nx * hw, y0 - ny * hw],
    ], color);
  }
}

// ---------------------------------------------------------------------------
// Draw the Farm Tycoon mark: a rounded green field tile with a golden wheat
// sheaf on top, outlined in the game's single sprite-outline colour.
// ---------------------------------------------------------------------------
function drawIcon(size) {
  const r = new Raster(size);
  const pad = size * 0.06;
  const radius = size * 0.22;

  // Field tile — soil border, grass fill, subtle raised-slab dark edge
  r.fillRoundedRect(pad, pad, size - pad, size - pad, radius, COLOR.soil);
  const inset = size * 0.05;
  r.fillRoundedRect(pad + inset, pad + inset, size - pad - inset, size - pad - inset, radius * 0.82, COLOR.field);
  // bottom-right shading arc to suggest a raised slab
  r.fillRoundedRect(pad + inset, size * 0.62, size - pad - inset, size - pad - inset, radius * 0.82, COLOR.fieldDark);
  r.fillRoundedRect(pad + inset, pad + inset, size - pad - inset, size * 0.60, radius * 0.82, COLOR.field);

  // Wheat sheaf, centered, built from a handful of blade polygons fanning
  // from a common base, plus a stem-tie band.
  const cx = size * 0.5;
  const baseY = size * 0.78;
  const tipY = size * 0.20;
  const spread = size * 0.20;
  const bladeWidth = size * 0.045;
  const blades = [-2, -1, 0, 1, 2];

  for (const b of blades) {
    const tipX = cx + b * spread * 0.5;
    const tipYy = tipY + Math.abs(b) * size * 0.04;
    const baseX = cx + b * (bladeWidth * 1.4);
    const midX = cx + b * spread * 0.32;
    const midY = size * 0.5;
    const points = [
      [baseX - bladeWidth * 0.5, baseY],
      [midX - bladeWidth * 0.5, midY],
      [tipX, tipYy],
      [midX + bladeWidth * 0.5, midY],
      [baseX + bladeWidth * 0.5, baseY],
    ];
    r.fillPolygon(points, b % 2 === 0 ? COLOR.wheat : COLOR.wheatDark);
  }

  // Stem below the tie band
  r.fillRoundedRect(cx - size * 0.02, baseY - size * 0.02, cx + size * 0.02, size - pad - inset - size * 0.04, size * 0.02, COLOR.stem);

  // Tie band across the sheaf base
  r.fillRoundedRect(cx - size * 0.13, baseY - size * 0.055, cx + size * 0.13, baseY + size * 0.02, size * 0.02, COLOR.stem);

  // Outer outline stroke to match the game's single-outline-color sprite style
  const outlineW = Math.max(1, size * 0.018);
  r.fillRoundedRect(pad, pad, size - pad, pad + outlineW, 0, COLOR.outline); // no-op thin edges kept simple; real stroke below
  strokeRoundedRectOutline(r, pad, pad, size - pad, size - pad, radius, outlineW, COLOR.outline);

  return r;
}

function strokeRoundedRectOutline(r, x0, y0, x1, y1, radius, width, color) {
  const steps = 64;
  const pts = [];
  const corners = [
    [x1 - radius, y0 + radius, -Math.PI / 2, 0],
    [x1 - radius, y1 - radius, 0, Math.PI / 2],
    [x0 + radius, y1 - radius, Math.PI / 2, Math.PI],
    [x0 + radius, y0 + radius, Math.PI, Math.PI * 1.5],
  ];
  for (const [ccx, ccy, a0, a1] of corners) {
    for (let i = 0; i <= steps / 4; i++) {
      const a = a0 + (a1 - a0) * (i / (steps / 4));
      pts.push([ccx + Math.cos(a) * radius, ccy + Math.sin(a) * radius]);
    }
  }
  pts.push(pts[0]);
  r.strokePolyline(pts, width, color);
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (RGBA, 8-bit, no interlace) using zlib deflate.
// ---------------------------------------------------------------------------
function crc32Buf(buf) {
  return zlib.crc32(buf) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32Buf(crcInput), 0);
  return Buffer.concat([len, crcInput, crc]);
}

function encodePNG(raster) {
  const size = raster.size;
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // no filter
    raster.data.subarray(y * size * 4, (y + 1) * size * 4).forEach((v, i) => {
      raw[rowStart + 1 + i] = v;
    });
  }
  const idat = deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// ICO container packing PNG-format entries (valid since Windows Vista for
// entries >= 256px, and widely supported by tooling/OS for smaller ones too).
// ---------------------------------------------------------------------------
function encodeICO(pngsBySize) {
  const sizes = Object.keys(pngsBySize).map(Number).sort((a, b) => a - b);
  const count = sizes.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const imageBuffers = [];
  let offset = 6 + count * 16;

  for (const size of sizes) {
    const png = pngsBySize[size];
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // width (0 means 256)
    entry[1] = size >= 256 ? 0 : size; // height
    entry[2] = 0; // color palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4);  // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    imageBuffers.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageBuffers]);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
const ICO_SIZES = [16, 32, 48, 128, 256];
const MASTER_SIZE = 512;

const pngsBySize = {};
for (const size of ICO_SIZES) {
  pngsBySize[size] = encodePNG(drawIcon(size));
}

const icoBuffer = encodeICO(pngsBySize);
writeFileSync(path.join(outDir, 'icon.ico'), icoBuffer);

const masterPng = encodePNG(drawIcon(MASTER_SIZE));
writeFileSync(path.join(outDir, 'icon.png'), masterPng);

// Verify: real .ico magic bytes are 00 00 01 00
const magicOk = icoBuffer[0] === 0x00 && icoBuffer[1] === 0x00 && icoBuffer[2] === 0x01 && icoBuffer[3] === 0x00;
console.log(`build/icon.ico written: ${icoBuffer.length} bytes, magic ${magicOk ? 'OK (00 00 01 00)' : 'WRONG'}, ${ICO_SIZES.length} images: ${ICO_SIZES.join(', ')}`);
console.log(`build/icon.png written: ${masterPng.length} bytes, ${MASTER_SIZE}x${MASTER_SIZE}`);
