// Tiny QR Code generator (byte mode), adapted from Project Nayuki's
// public-domain QR Code generator. Enough to encode a URL and draw it as SVG.
// No external calls — works fully offline.

const ECC_M = 0; // we use error-correction level M
// ECC codewords per block and block counts, [M] only, versions 1..10
const ECC_CODEWORDS_M = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS_M = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
// total data codewords (level M) versions 1..10
const DATA_CW_M = [16, 28, 44, 64, 86, 108, 124, 154, 182, 216];

function bitBuffer() {
  const bits = [];
  return {
    bits,
    put(val, len) { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
  };
}

// Reed-Solomon over GF(256)
const EXP = new Array(256), LOG = new Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  EXP[255] = EXP[0];
})();
const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[(LOG[a] + LOG[b]) % 255];
// Generator polynomial, leading coefficient first, length deg+1.
function genPoly(deg) {
  let g = [1];
  for (let i = 0; i < deg; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { ng[j] ^= gmul(g[j], EXP[i]); ng[j + 1] ^= g[j]; }
    g = ng;
  }
  return g.reverse(); // leading coefficient (the 1) first, for long division
}
// Polynomial long division remainder (the ECC codewords).
function rsRemainder(data, deg) {
  const g = genPoly(deg);
  const msg = [...data, ...new Array(deg).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) for (let j = 0; j < g.length; j++) msg[i + j] ^= gmul(g[j], coef);
  }
  return msg.slice(data.length);
}

function pickVersion(len) {
  // bytes: mode(4) + count(8 or 16) + data(8*len) must fit DATA_CW_M*8
  for (let v = 1; v <= 10; v++) {
    const countBits = v < 10 ? 8 : 16;
    const need = 4 + countBits + 8 * len;
    if (need <= DATA_CW_M[v - 1] * 8) return v;
  }
  throw new Error("Data too long for QR (keep the URL short)");
}

export function qrMatrix(text, forceMask = null) {
  const bytes = new TextEncoder().encode(text);
  const ver = pickVersion(bytes.length);
  const size = 17 + ver * 4;
  const totalData = DATA_CW_M[ver - 1];

  // 1) bitstream
  const bb = bitBuffer();
  bb.put(0b0100, 4);                         // byte mode
  bb.put(bytes.length, ver < 10 ? 8 : 16);   // char count
  for (const b of bytes) bb.put(b, 8);
  // terminator + pad to byte
  const capacity = totalData * 8;
  for (let i = 0; i < 4 && bb.bits.length < capacity; i++) bb.bits.push(0);
  while (bb.bits.length % 8 !== 0) bb.bits.push(0);
  const dataCW = [];
  for (let i = 0; i < bb.bits.length; i += 8) {
    let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bb.bits[i + j];
    dataCW.push(v);
  }
  const padBytes = [0xec, 0x11];
  for (let i = 0; dataCW.length < totalData; i++) dataCW.push(padBytes[i % 2]);

  // 2) split into blocks, add ECC
  const numBlocks = NUM_BLOCKS_M[ver - 1];
  const eccPer = ECC_CODEWORDS_M[ver - 1];
  const shortLen = Math.floor(totalData / numBlocks);
  const numLong = totalData % numBlocks;
  const blocks = [];
  let p = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = shortLen + (b >= numBlocks - numLong ? 1 : 0);
    const data = dataCW.slice(p, p + len); p += len;
    blocks.push({ data, ecc: rsRemainder(data, eccPer) });
  }
  // interleave
  const finalCW = [];
  const maxData = Math.max(...blocks.map(b => b.data.length));
  for (let i = 0; i < maxData; i++) for (const bl of blocks) if (i < bl.data.length) finalCW.push(bl.data[i]);
  for (let i = 0; i < eccPer; i++) for (const bl of blocks) finalCW.push(bl.ecc[i]);

  // 3) place modules
  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (r, c, v) => { m[r][c] = v; reserved[r][c] = true; };

  function finder(r, c) {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const inRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
        (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      setF(rr, cc, inRing);
    }
  }
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  // timing
  for (let i = 8; i < size - 8; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  // alignment (versions 2..10 have one at a known position)
  const alignPos = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]][ver];
  for (const ar of alignPos) for (const ac of alignPos) {
    if (reserved[ar][ac]) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
      setF(ar + dr, ac + dc, on);
    }
  }
  // dark module + reserve format areas
  setF(size - 8, 8, true);
  for (let i = 0; i < 9; i++) { if (!reserved[8][i]) reserved[8][i] = true; if (!reserved[i][8]) reserved[i][8] = true; }
  for (let i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }

  // 4) data placement (zigzag), unmasked for now; record which cells are data
  let bitIdx = 0;
  const totalBits = finalCW.length * 8;
  const getBit = i => i < totalBits ? (finalCW[i >> 3] >> (7 - (i & 7))) & 1 : 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip timing column
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (reserved[row][c]) continue;
        m[row][c] = getBit(bitIdx++) === 1;
      }
    }
    upward = !upward;
  }

  // 5) pick the mask with the lowest penalty, apply it, draw its format info
  const chosen = forceMask != null ? forceMask : bestMask(m, reserved, size);
  applyMask(m, reserved, size, chosen);
  drawFormat(m, size, chosen);
  return m.map(row => row.map(v => v === true));
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];
function applyMask(m, reserved, size, mask) {
  const fn = MASKS[mask];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
    if (!reserved[r][c] && fn(r, c)) m[r][c] = !m[r][c];
}
function drawFormat(m, size, mask) {
  const fmtData = (0b00 << 3) | mask; // EC level M = 0b00
  let bch = fmtData << 10;
  for (let i = 14; i >= 10; i--) if ((bch >> i) & 1) bch ^= 0b10100110111 << (i - 10);
  const fmt = ((fmtData << 10) | bch) ^ 0b101010000010010;
  const fbit = i => ((fmt >> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) m[8][i] = fbit(i);
  m[8][7] = fbit(6); m[8][8] = fbit(7); m[7][8] = fbit(8);
  for (let i = 9; i <= 14; i++) m[14 - i][8] = fbit(i);
  for (let i = 0; i <= 6; i++) m[size - 1 - i][8] = fbit(i);
  for (let i = 7; i <= 14; i++) m[8][size - 15 + i] = fbit(i);
}
// Standard four-rule penalty, to choose the least-noisy mask.
function penalty(m, size) {
  let p = 0;
  const at = (r, c) => m[r][c] === true;
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (at(r, c) === at(r, c - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
      else run = 1;
    }
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (at(r, c) === at(r - 1, c)) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
      else run = 1;
    }
  }
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++)
    if (at(r, c) === at(r, c + 1) && at(r, c) === at(r + 1, c) && at(r, c) === at(r + 1, c + 1)) p += 3;
  const pat = [true, false, true, true, true, false, true, false, false, false, false];
  const match = (r, c, dr, dc) => { for (let k = 0; k < 11; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr >= size || cc >= size || at(rr, cc) !== pat[k]) return false; } return true; };
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (match(r, c, 0, 1)) p += 40;
    if (match(r, c, 1, 0)) p += 40;
  }
  let dark = 0; for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (at(r, c)) dark++;
  const pct = dark * 100 / (size * size);
  p += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return p;
}
function bestMask(m, reserved, size) {
  let best = 0, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const copy = m.map(r => r.slice());
    applyMask(copy, reserved, size, mask);
    drawFormat(copy, size, mask);
    const p = penalty(copy, size);
    if (p < bestP) { bestP = p; best = mask; }
  }
  return best;
}

export function qrSvg(text, { pad = 4 } = {}) {
  const m = qrMatrix(text);
  const n = m.length, dim = n + pad * 2;
  let path = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) path += `M${c + pad} ${r + pad}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR code">
    <rect width="${dim}" height="${dim}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
