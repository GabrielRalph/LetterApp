/**
 * Compact codec for LetterTilesState key values.
 *
 * Encoding strategy:
 *   - Numbers      : base-62 (digits 0-9, then a-z, then A-Z).
 *                    `toB62` / `fromB62` handle negatives with a leading '-'.
 *   - Path points  : delta-encoded flat pairs [x0,y0,Δx1,Δy1,…] joined by ','.
 *                    First point is absolute; subsequent are deltas from previous.
 *                    Coordinates are rounded to integers before encoding.
 *   - Booleans     : '1' / '0'
 *   - mode         : 's' (select) | 'd' (draw) | 'e' (eraser)
 *   - Records      : separated by RECORD_SEP '|'
 *   - Fields       : separated by FIELD_SEP  '~'
 *   - Colors       : '#' stripped, lowercased 6-char hex (e.g. '#E53935' → 'e53935')
 *   - null / empty : empty string ''
 *   - Freeform text: escaped with backslash so '~' and '|' inside values are safe.
 *
 * Exports:
 *   serializeKey(key, value) → compact string
 *   deserializeKey(key, str) → original value
 */

// ── Base-62 ───────────────────────────────────────────────────────────────────

const B62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** @param {number} n */
function toB62(n) {
  n = Math.round(n);
  if (!isFinite(n) || n === 0) return '0';
  const neg = n < 0;
  n = Math.abs(n);
  let s = '';
  while (n > 0) {
    s = B62[n % 62] + s;
    n = Math.floor(n / 62);
  }
  return neg ? '-' + s : s;
}

/** @param {string} s */
function fromB62(s) {
  if (!s || s === '0') return 0;
  if (s[0] === '-') return -fromB62(s.slice(1));
  let n = 0;
  for (const c of s) n = n * 62 + B62.indexOf(c);
  return n;
}

// ── Delimiters ────────────────────────────────────────────────────────────────
// None of these appear in the B62 alphabet or in valid non-text field values.

const RECORD_SEP = '|'; // separates tiles / paths / word-bank entries from each other
const FIELD_SEP  = '~'; // separates fields within one tile or path record
const COORD_SEP  = ','; // separates values in the flat path-point array

// ── Freeform-text escaping ────────────────────────────────────────────────────
// Applied to grapheme, category, subcategory, phoneme, wordBank words, lookedUpWord.
// In practice these fields only contain letters, but we escape defensively.

/** @param {string} s */
function escField(s) {
  return s.replace(/\\/g, '\\\\').replace(/~/g, '\\t').replace(/\|/g, '\\p');
}

/** @param {string} s */
function unescField(s) {
  return s.replace(/\\p/g, '|').replace(/\\t/g, '~').replace(/\\\\/g, '\\');
}

// ── Color helpers ─────────────────────────────────────────────────────────────
// Only #rrggbb hex colors are supported (all colors in this app use that format).

/** @param {string} color  e.g. '#E53935' */
function encodeColor(color) {
  return color.replace('#', '').toLowerCase();
}

/** @param {string} s  e.g. 'e53935' */
function decodeColor(s) {
  return '#' + s;
}

// ── Path-point codec ──────────────────────────────────────────────────────────

/**
 * Encode an array of {x,y} points as a compact string.
 * Format: x0,y0,Δx1,Δy1,Δx2,Δy2,… (all base-62, integers)
 * @param {{x:number,y:number}[]} points
 * @returns {string}
 */
function encodePoints(points) {
  if (!points.length) return '';
  const nums = [];
  let px = 0, py = 0;
  for (let i = 0; i < points.length; i++) {
    const x = Math.round(points[i].x);
    const y = Math.round(points[i].y);
    if (i === 0) {
      nums.push(toB62(x), toB62(y));
    } else {
      nums.push(toB62(x - px), toB62(y - py));
    }
    px = x; py = y;
  }
  return nums.join(COORD_SEP);
}

/**
 * Decode a compact point string back to an array of {x,y}.
 * @param {string} str
 * @returns {{x:number,y:number}[]}
 */
function decodePoints(str) {
  if (!str) return [];
  const parts = str.split(COORD_SEP);
  const points = [];
  let px = 0, py = 0;
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const dx = fromB62(parts[i]);
    const dy = fromB62(parts[i + 1]);
    if (i === 0) {
      px = dx; py = dy;
    } else {
      px += dx; py += dy;
    }
    points.push({ x: px, y: py });
  }
  return points;
}

// ── Tiles ─────────────────────────────────────────────────────────────────────
// Each CanvasTile is encoded as 10 FIELD_SEP-delimited fields:
//   instanceId ~ tileId ~ grapheme ~ category ~ color6hex ~ subcategory ~ phoneme ~ xB62 ~ yB62 ~ uppercase01

/**
 * @param {import('./sync.js').CanvasTile[]} tiles
 * @returns {string}
 */
function serializeTiles(tiles) {
  if (!tiles.length) return '';
  return tiles.map(ct => {
    const t = ct.tile;
    return [
      ct.instanceId,
      t.id,
      escField(t.grapheme),
      escField(t.category),
      encodeColor(t.color),
      escField(t.subcategory ?? ''),
      escField(t.phoneme ?? ''),
      toB62(ct.x),
      toB62(ct.y),
      ct.uppercase ? '1' : '0',
    ].join(FIELD_SEP);
  }).join(RECORD_SEP);
}

/**
 * @param {string} str
 * @returns {import('./sync.js').CanvasTile[]}
 */
function deserializeTiles(str) {
  if (!str) return [];
  return str.split(RECORD_SEP).map(rec => {
    const [iid, tid, gr, cat, col, sub, pho, x, y, uc] = rec.split(FIELD_SEP);
    return {
      instanceId: iid,
      tile: {
        id: tid,
        grapheme: unescField(gr),
        category: unescField(cat),
        color: decodeColor(col),
        subcategory: sub ? unescField(sub) : null,
        phoneme: pho ? unescField(pho) : null,
      },
      x: fromB62(x),
      y: fromB62(y),
      uppercase: uc === '1',
    };
  });
}

// ── Paths ─────────────────────────────────────────────────────────────────────
// Each DrawPath is encoded as 4 FIELD_SEP-delimited fields:
//   id ~ color6hex ~ widthB62 ~ encodedPoints

/**
 * @param {import('./sync.js').DrawPath[]} paths
 * @returns {string}
 */
function serializePaths(paths) {
  if (!paths.length) return '';
  return paths.map(p => [
    p.id,
    encodeColor(p.color),
    toB62(p.width),
    encodePoints(p.points),
  ].join(FIELD_SEP)).join(RECORD_SEP);
}

/**
 * @param {string} str
 * @returns {import('./sync.js').DrawPath[]}
 */
function deserializePaths(str) {
  if (!str) return [];
  return str.split(RECORD_SEP).map(rec => {
    // Split into exactly 4 parts; points field may contain commas but never FIELD_SEP.
    const [id, col, w, pts] = rec.split(FIELD_SEP);
    return {
      id,
      color: decodeColor(col),
      width: fromB62(w),
      points: decodePoints(pts ?? ''),
    };
  });
}

// ── Mode mapping ──────────────────────────────────────────────────────────────

/** @type {Record<string,string>} */
const MODE_ENC = { select: 's', draw: 'd', eraser: 'e' };
/** @type {Record<string,string>} */
const MODE_DEC = { s: 'select', d: 'draw', e: 'eraser' };

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Serialize one LetterTilesState key's value to a compact string
 * suitable for storage in Firebase Realtime Database.
 *
 * @param {keyof import('./sync.js').LetterTilesState} key
 * @param {*} value
 * @returns {string}
 */
export function serializeKey(key, value) {
  switch (key) {
    case 'tiles':            return serializeTiles(value);
    case 'paths':            return serializePaths(value);
    case 'mode':             return MODE_ENC[value] ?? value;
    case 'selectedIds':      return value.join(RECORD_SEP);
    case 'lookedUpWord':     return value != null ? escField(value) : '';
    case 'isDictionaryOpen': return value ? '1' : '0';
    case 'wordBank':         return value.map(escField).join(RECORD_SEP);
    case 'isWordBankOpen':   return value ? '1' : '0';
    case 'activePaletteTab': return toB62(value);
    case 'dragPosition':
      return value
        ? [value.instanceId, toB62(value.x), toB62(value.y)].join(FIELD_SEP)
        : '';
    default:
      return JSON.stringify(value);
  }
}

/**
 * Deserialize a compact string (from Firebase) back to the original
 * LetterTilesState key's value.
 *
 * @param {keyof import('./sync.js').LetterTilesState} key
 * @param {string} str
 * @returns {*}
 */
export function deserializeKey(key, str) {
  switch (key) {
    case 'tiles':            return deserializeTiles(str);
    case 'paths':            return deserializePaths(str);
    case 'mode':             return MODE_DEC[str] ?? str;
    case 'selectedIds':      return str ? str.split(RECORD_SEP) : [];
    case 'lookedUpWord':     return str ? unescField(str) : null;
    case 'isDictionaryOpen': return str === '1';
    case 'wordBank':         return str ? str.split(RECORD_SEP).map(unescField) : [];
    case 'isWordBankOpen':   return str === '1';
    case 'activePaletteTab': return fromB62(str);
    case 'dragPosition': {
      if (!str) return null;
      const [iid, x, y] = str.split(FIELD_SEP);
      return { instanceId: iid, x: fromB62(x), y: fromB62(y) };
    }
    default:
      return JSON.parse(str);
  }
}
