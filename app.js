/**
 * Main application logic — wires together all web components with shared state.
 */
import { TILE_DATA } from './tile-data.js';
import { _notifyStateChanged, _registerStateApplier } from './sync.js';
import { TILE_SIZE } from './components/canvas-tile.js';

const SNAP_DIST = 42;

// ─── Utility ─────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).substring(2, 10);
}

// ─── Union-find word grouping ────────────────────────────────────────────────

function buildParent(tiles) {
  const parent = new Map();
  tiles.forEach(t => parent.set(t.instanceId, t.instanceId));

  function find(id) {
    const p = parent.get(id);
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  }

  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i], b = tiles[j];
      const dx = Math.abs(Math.abs(a.x - b.x) - TILE_SIZE);
      const dy = Math.abs(a.y - b.y);
      if (dx < 8 && dy < 14) {
        parent.set(find(a.instanceId), find(b.instanceId));
      }
    }
  }
  return parent;
}

function getGroupId(instanceId, parent) {
  const p = parent.get(instanceId);
  if (!p || p === instanceId) return instanceId;
  const root = getGroupId(p, parent);
  parent.set(instanceId, root);
  return root;
}

function computeWordGroups(tiles) {
  const parent = buildParent(tiles);
  const byGroup = new Map();
  tiles.forEach(t => {
    const gId = getGroupId(t.instanceId, parent);
    if (!byGroup.has(gId)) byGroup.set(gId, []);
    byGroup.get(gId).push(t);
  });

  return Array.from(byGroup.values())
    .filter(members => members.length >= 2)
    .map(members => {
      const sorted = [...members].sort((a, b) => a.x - b.x);
      const text = sorted.map(t => t.tile.grapheme.replace(/-/g, '')).join('');
      return {
        id: getGroupId(sorted[0].instanceId, parent),
        tiles: sorted,
        text,
        x: sorted[0].x,
        y: sorted[0].y,
        width: sorted.length * TILE_SIZE,
      };
    });
}

// ─── Snap computation ────────────────────────────────────────────────────────

function computeSnap(x, y, instanceId, tiles) {
  const others = tiles.filter(t => t.instanceId !== instanceId);
  for (const other of others) {
    const rightEdge = other.x + TILE_SIZE;
    if (Math.abs(x - rightEdge) < SNAP_DIST && Math.abs(y - other.y) < SNAP_DIST) {
      return { x: rightEdge, y: other.y, indicatorX: rightEdge, snapTo: other, direction: 'after' };
    }
    if (Math.abs(x + TILE_SIZE - other.x) < SNAP_DIST && Math.abs(y - other.y) < SNAP_DIST) {
      return { x: other.x - TILE_SIZE, y: other.y, indicatorX: other.x, snapTo: other, direction: 'before' };
    }
  }
  return null;
}

// ─── Insert helpers ──────────────────────────────────────────────────────────

function insertBeforeTile(targetTile, newTileDef, allTiles) {
  const parent = buildParent(allTiles);
  const targetGroupId = getGroupId(targetTile.instanceId, parent);
  const updated = allTiles.map(t => {
    if (getGroupId(t.instanceId, parent) === targetGroupId && t.x >= targetTile.x) {
      return { ...t, x: t.x + TILE_SIZE };
    }
    return t;
  });
  return [...updated, { instanceId: genId(), tile: newTileDef, x: targetTile.x, y: targetTile.y }];
}

function insertAfterTile(targetTile, newTileDef, allTiles) {
  const parent = buildParent(allTiles);
  const targetGroupId = getGroupId(targetTile.instanceId, parent);
  const insertX = targetTile.x + TILE_SIZE;
  const updated = allTiles.map(t => {
    if (getGroupId(t.instanceId, parent) === targetGroupId && t.x > targetTile.x) {
      return { ...t, x: t.x + TILE_SIZE };
    }
    return t;
  });
  return [...updated, { instanceId: genId(), tile: newTileDef, x: insertX, y: targetTile.y }];
}

// Variants that move an existing canvas tile (preserving its instanceId)
function insertCanvasTileBeforeTile(targetTile, canvasTile, allTiles) {
  const parent = buildParent(allTiles);
  const targetGroupId = getGroupId(targetTile.instanceId, parent);
  const updated = allTiles.map(t => {
    if (getGroupId(t.instanceId, parent) === targetGroupId && t.x >= targetTile.x) {
      return { ...t, x: t.x + TILE_SIZE };
    }
    return t;
  });
  return [...updated, { ...canvasTile, x: targetTile.x, y: targetTile.y }];
}

function insertCanvasTileAfterTile(targetTile, canvasTile, allTiles) {
  const parent = buildParent(allTiles);
  const targetGroupId = getGroupId(targetTile.instanceId, parent);
  const insertX = targetTile.x + TILE_SIZE;
  const updated = allTiles.map(t => {
    if (getGroupId(t.instanceId, parent) === targetGroupId && t.x > targetTile.x) {
      return { ...t, x: t.x + TILE_SIZE };
    }
    return t;
  });
  return [...updated, { ...canvasTile, x: insertX, y: targetTile.y }];
}

// ─── App State ───────────────────────────────────────────────────────────────

let state = {
  tiles: [],
  paths: [],
  mode: 'select',
  selectedIds: [],
  lookedUpWord: null,
  isDictionaryOpen: false,
  wordBank: [],
  isWordBankOpen: false,
  activePaletteTab: 0,
  dragPosition: null,
};

let history = [];
const MAX_HISTORY = 30;

// ─── DOM References ──────────────────────────────────────────────────────────

const canvasArea = document.querySelector('canvas-area');
const tilePalette = document.querySelector('tile-palette');
const toolbar = document.querySelector('app-toolbar');
const wordBankPanel = document.querySelector('word-bank-panel');

// ─── Render ──────────────────────────────────────────────────────────────────

function render() {
  const wordGroups = computeWordGroups(state.tiles);

  canvasArea.renderTiles(state.tiles, state.selectedIds);
  canvasArea.renderWordGroups(wordGroups);
  canvasArea.drawingLayer.mode = state.mode;
  canvasArea.drawingLayer.renderPaths(state.paths);

  // Dictionary
  const dict = canvasArea.dictionaryPanel;
  if (state.isDictionaryOpen && state.lookedUpWord) {
    if (!dict.isOpen || dict._word !== state.lookedUpWord) {
      dict.open(state.lookedUpWord);
    }
  } else {
    dict.close();
  }

  // Word bank
  wordBankPanel.words = state.wordBank;
  if (state.isWordBankOpen) wordBankPanel.open();
  else wordBankPanel.close();

  // Palette tab
  if (tilePalette.activeTab !== state.activePaletteTab) {
    tilePalette.activeTab = state.activePaletteTab;
  }

  // Toolbar
  const activeWord = computeActiveWord(wordGroups);
  toolbar.update({
    mode: state.mode,
    activeWord,
    wordGroups,
    tileCount: state.tiles.length,
    selectedCount: state.selectedIds.length,
    isWordBankOpen: state.isWordBankOpen,
  });
}

function computeActiveWord(wordGroups) {
  const firstId = state.selectedIds[0];
  if (!firstId) return '';
  const group = wordGroups.find(g => g.tiles.some(t => t.instanceId === firstId));
  if (group) return group.text;
  const solo = state.tiles.find(t => t.instanceId === firstId);
  return solo?.tile.grapheme.replace(/-/g, '') || '';
}

function updateState(partial) {
  Object.assign(state, partial);
  render();
  _notifyStateChanged({ ...state });
}

function saveHistory() {
  history = [...history.slice(-MAX_HISTORY), { tiles: JSON.parse(JSON.stringify(state.tiles)), paths: JSON.parse(JSON.stringify(state.paths)) }];
}

// ─── Register state applier for external setState() ──────────────────────────

_registerStateApplier((incoming) => {
  state = { ...incoming };
  // During a group drag, follower tile positions are managed manually via
  // el.style.left/top. Calling render() here would reset those visuals because
  // follower tiles have no _drag guard. State is still updated so the final
  // drag-end write includes any concurrent remote changes.
  if (!groupDrag) render();
});

// ─── Event Handlers ──────────────────────────────────────────────────────────

// Tile drag
let groupDrag = null;

document.addEventListener('tile-drag-start', (e) => {
  const { instanceId } = e.detail;
  const groups = computeWordGroups(state.tiles);
  const group = groups.find(g => g.tiles[0]?.instanceId === instanceId);
  if (group && group.tiles.length > 1) {
    const ids = group.tiles.map(t => t.instanceId);
    const initPositions = new Map();
    state.tiles.forEach(t => { if (ids.includes(t.instanceId)) initPositions.set(t.instanceId, { x: t.x, y: t.y }); });
    groupDrag = { leadId: instanceId, ids, initPositions };
  } else {
    groupDrag = null;
  }
  saveHistory();
});

document.addEventListener('tile-drag-move', (e) => {
  const { instanceId, x, y } = e.detail;
  state.dragPosition = { instanceId, x, y };

  if (groupDrag && groupDrag.leadId === instanceId) {
    canvasArea.snapIndicator.style.display = 'none';
    const leadInit = groupDrag.initPositions.get(instanceId);
    const dx = x - leadInit.x;
    const dy = y - leadInit.y;
    groupDrag.ids.forEach(id => {
      if (id === instanceId) return;
      const el = canvasArea.querySelector(`canvas-tile[instance-id="${id}"]`);
      if (!el) return;
      const init = groupDrag.initPositions.get(id);
      el.style.left = (init.x + dx) + 'px';
      el.style.top = (init.y + dy) + 'px';
      el.classList.add('dragging');
    });
  } else {
    const snap = computeSnap(x, y, instanceId, state.tiles);
    const ind = canvasArea.snapIndicator;
    if (snap) {
      ind.style.display = 'block';
      ind.style.left = (snap.indicatorX - 16) + 'px';
      ind.style.top = snap.y + 'px';
    } else {
      ind.style.display = 'none';
    }
  }

  _notifyStateChanged({ ...state });
});

document.addEventListener('tile-drag-end', (e) => {
  const { instanceId, x: rawX, y: rawY, moved } = e.detail;
  canvasArea.snapIndicator.style.display = 'none';
  state.dragPosition = null;

  if (!moved) {
    groupDrag = null;
    render();
    return;
  }

  if (groupDrag && groupDrag.leadId === instanceId) {
    const leadInit = groupDrag.initPositions.get(instanceId);
    const dx = rawX - leadInit.x;
    const dy = rawY - leadInit.y;
    state.tiles = state.tiles.map(t => {
      if (!groupDrag.ids.includes(t.instanceId)) return t;
      const init = groupDrag.initPositions.get(t.instanceId);
      return { ...t, x: init.x + dx, y: init.y + dy };
    });
    // Reset follower visual states
    groupDrag.ids.forEach(id => {
      const el = canvasArea.querySelector(`canvas-tile[instance-id="${id}"]`);
      if (el) el.classList.remove('dragging');
    });
    groupDrag = null;
  } else {
    // Single tile with snap
    const snap = computeSnap(rawX, rawY, instanceId, state.tiles);

    if (snap) {
      const dragged = state.tiles.find(t => t.instanceId === instanceId);
      const withoutDragged = state.tiles.filter(t => t.instanceId !== instanceId);

      // If the snap position is already occupied, insert the tile into the word
      // (shift existing tiles to make room) rather than overlapping them.
      const willOverlap = withoutDragged.some(t => t.x === snap.x && t.y === snap.y);

      if (willOverlap) {
        state.tiles = snap.direction === 'before'
          ? insertCanvasTileBeforeTile(snap.snapTo, dragged, withoutDragged)
          : insertCanvasTileAfterTile(snap.snapTo, dragged, withoutDragged);
      } else {
        state.tiles = state.tiles.map(t =>
          t.instanceId === instanceId ? { ...t, x: snap.x, y: snap.y } : t
        );
      }
    } else {
      state.tiles = state.tiles.map(t =>
        t.instanceId === instanceId ? { ...t, x: rawX, y: rawY } : t
      );
    }
  }

  updateState({ tiles: state.tiles });
});

// Tile click (select/deselect)
document.addEventListener('tile-click', (e) => {
  if (state.mode !== 'select') return;
  const { instanceId } = e.detail;
  const sel = state.selectedIds.includes(instanceId)
    ? state.selectedIds.filter(id => id !== instanceId)
    : [...state.selectedIds, instanceId];
  updateState({ selectedIds: sel });
});

// Tile double-click (lookup)
document.addEventListener('tile-dblclick', (e) => {
  const { instanceId } = e.detail;
  const tile = state.tiles.find(t => t.instanceId === instanceId);
  if (!tile) return;
  const groups = computeWordGroups(state.tiles);
  const group = groups.find(g => g.tiles.some(t => t.instanceId === instanceId));
  const word = group?.text || tile.tile.grapheme.replace(/-/g, '');
  if (word.length >= 2) {
    updateState({ lookedUpWord: word, isDictionaryOpen: true });
  }
});

// Canvas click (deselect all)
document.addEventListener('canvas-click', () => {
  updateState({ selectedIds: [] });
});

// Palette drag → canvas drop
document.addEventListener('canvas-dragover', (e) => {
  const { clientX, clientY } = e.detail;
  const canvasInner = canvasArea.querySelector('.canvas-inner');
  const rect = canvasInner.getBoundingClientRect();
  const cursorX = clientX - rect.left;
  const cursorY = clientY - rect.top;

  const nearTile = state.tiles.find(t =>
    cursorX >= t.x && cursorX <= t.x + TILE_SIZE &&
    cursorY >= t.y && cursorY <= t.y + TILE_SIZE
  );

  const dropInd = canvasArea.dropIndicator;
  if (nearTile) {
    const isLeft = cursorX - nearTile.x < TILE_SIZE / 2;
    const indicatorX = isLeft ? nearTile.x : nearTile.x + TILE_SIZE;
    dropInd.style.display = 'block';
    dropInd.style.left = (indicatorX - 16) + 'px';
    dropInd.style.top = nearTile.y + 'px';
    dropInd.style.height = TILE_SIZE + 'px';
  } else {
    dropInd.style.display = 'none';
  }
});

document.addEventListener('canvas-drop', (e) => {
  const { x: cursorX, y: cursorY } = e.detail;
  const tileDef = tilePalette.dragTile;
  if (!tileDef) return;

  saveHistory();

  const hitTile = state.tiles.find(t =>
    cursorX >= t.x && cursorX <= t.x + TILE_SIZE &&
    cursorY >= t.y && cursorY <= t.y + TILE_SIZE
  );

  if (hitTile) {
    const isLeft = cursorX - hitTile.x < TILE_SIZE / 2;
    state.tiles = isLeft
      ? insertBeforeTile(hitTile, tileDef, state.tiles)
      : insertAfterTile(hitTile, tileDef, state.tiles);
  } else {
    const x = Math.max(0, cursorX - TILE_SIZE / 2);
    const y = Math.max(0, cursorY - TILE_SIZE / 2);
    state.tiles = [...state.tiles, { instanceId: genId(), tile: tileDef, x, y }];
  }

  updateState({ tiles: state.tiles });
});

// Drawing
document.addEventListener('path-added', (e) => {
  saveHistory();
  state.paths = [...state.paths, e.detail.path];
  updateState({ paths: state.paths });
});

document.addEventListener('erase-near', (e) => {
  const { x, y } = e.detail;
  const before = state.paths.length;
  state.paths = state.paths.filter(path =>
    !path.points.some(p => Math.hypot(p.x - x, p.y - y) < 20)
  );
  if (state.paths.length !== before) {
    updateState({ paths: state.paths });
  }
});

// Tool mode change
document.addEventListener('tool-change', (e) => {
  updateState({ mode: e.detail.mode });
});

// Toolbar actions
document.addEventListener('toolbar-action', (e) => {
  const { action } = e.detail;
  switch (action) {
    case 'delete':
      deleteSelected();
      break;
    case 'toggle-case':
      toggleCase();
      break;
    case 'toggle-wordbank':
      updateState({ isWordBankOpen: !state.isWordBankOpen });
      break;
    case 'clear':
      showClearConfirm();
      break;
  }
});

// Lookup word
document.addEventListener('lookup-word', (e) => {
  updateState({ lookedUpWord: e.detail.word, isDictionaryOpen: true });
});

// Dictionary close
document.addEventListener('dictionary-close', () => {
  updateState({ isDictionaryOpen: false });
});

// Palette tab change
document.addEventListener('palette-tab-change', (e) => {
  updateState({ activePaletteTab: e.detail.tab });
});

// Word bank events
document.addEventListener('word-add', (e) => {
  const { word } = e.detail;
  if (!state.wordBank.includes(word)) {
    updateState({ wordBank: [...state.wordBank, word] });
  }
});

document.addEventListener('word-remove', (e) => {
  updateState({ wordBank: state.wordBank.filter(w => w !== e.detail.word) });
});

document.addEventListener('word-place', (e) => {
  placeWord(e.detail.word);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  }
});

// ─── Actions ─────────────────────────────────────────────────────────────────

function deleteSelected() {
  if (state.selectedIds.length === 0) return;
  saveHistory();
  const parent = buildParent(state.tiles);
  const affectedGroupIds = new Set(state.selectedIds.map(id => getGroupId(id, parent)));
  const remaining = state.tiles.filter(t => !state.selectedIds.includes(t.instanceId));

  // Compact affected groups
  const byGroup = new Map();
  remaining.forEach(t => {
    const gId = getGroupId(t.instanceId, parent);
    if (affectedGroupIds.has(gId)) {
      if (!byGroup.has(gId)) byGroup.set(gId, []);
      byGroup.get(gId).push(t);
    }
  });

  const updates = new Map();
  byGroup.forEach(groupTiles => {
    const sorted = [...groupTiles].sort((a, b) => a.x - b.x);
    let cursorX = sorted[0].x;
    sorted.forEach(tile => {
      if (tile.x > cursorX + 4) updates.set(tile.instanceId, { ...tile, x: cursorX });
      cursorX += TILE_SIZE;
    });
  });

  state.tiles = remaining.map(t => updates.get(t.instanceId) || t);
  updateState({ tiles: state.tiles, selectedIds: [] });
}

function toggleCase() {
  saveHistory();
  state.tiles = state.tiles.map(t =>
    state.selectedIds.includes(t.instanceId) ? { ...t, uppercase: !t.uppercase } : t
  );
  updateState({ tiles: state.tiles });
}

function undo() {
  if (history.length === 0) return;
  const last = history.pop();
  state.tiles = last.tiles;
  state.paths = last.paths;
  updateState({ tiles: state.tiles, paths: state.paths });
}

function placeWord(word) {
  const allTileDefs = TILE_DATA.tileSets.flatMap(s => s.tiles);
  const sorted = [...allTileDefs].sort((a, b) => b.grapheme.length - a.grapheme.length);

  const matched = [];
  let remaining = word.toLowerCase();
  while (remaining.length > 0) {
    let found = false;
    for (const def of sorted) {
      const g = def.grapheme.toLowerCase().replace(/-/g, '');
      if (g.length > 0 && remaining.startsWith(g)) {
        matched.push(def);
        remaining = remaining.slice(g.length);
        found = true;
        break;
      }
    }
    if (!found) {
      const ch = remaining[0];
      matched.push({ id: `fallback-${ch}`, grapheme: ch, category: 'consonant', color: '#fff' });
      remaining = remaining.slice(1);
    }
  }

  if (matched.length === 0) return;
  saveHistory();

  const startY = state.tiles.length > 0
    ? Math.max(...state.tiles.map(t => t.y)) + TILE_SIZE + 30
    : 60;
  const startX = 60;

  const newTiles = matched.map((def, i) => ({
    instanceId: genId(),
    tile: def,
    x: startX + i * TILE_SIZE,
    y: startY,
  }));

  updateState({ tiles: [...state.tiles, ...newTiles] });
}

function showClearConfirm() {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <h3>Clear Canvas?</h3>
      <p>This will remove all tiles and drawings from the canvas.</p>
      <div class="btn-row">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-confirm">Clear</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.btn-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('.btn-confirm').addEventListener('click', () => {
    overlay.remove();
    saveHistory();
    updateState({ tiles: [], paths: [], selectedIds: [] });
  });
}

// ─── Initial render ──────────────────────────────────────────────────────────

render();
