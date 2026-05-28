/**
 * State synchronization module for Letter Tiles.
 * Exports: addChangeListener, getState, setState
 */

/**
 * @typedef {{ id: string, grapheme: string, category: string, color: string, subcategory?: string|null, phoneme?: string|null }} TileDef
 * @typedef {{ instanceId: string, tile: TileDef, x: number, y: number, uppercase?: boolean }} CanvasTile
 * @typedef {{ id: string, points: {x:number,y:number}[], color: string, width: number }} DrawPath
 * @typedef {'select'|'draw'|'eraser'} ToolMode
 * @typedef {{ id: string, tiles: CanvasTile[], text: string, x: number, y: number, width: number }} WordGroup
 *
 * @typedef {{
 *   tiles: CanvasTile[],
 *   paths: DrawPath[],
 *   mode: ToolMode,
 *   selectedIds: string[],
 *   lookedUpWord: string|null,
 *   isDictionaryOpen: boolean,
 *   wordBank: string[],
 *   isWordBankOpen: boolean,
 *   activePaletteTab: number,
 *   dragPosition: {instanceId:string, x:number, y:number}|null
 * }} LetterTilesState
 *
 * @typedef {(state: LetterTilesState, changedKeys: (keyof LetterTilesState)[]) => void} ChangeListener
 */

const listeners = new Set();
let suppressNotifications = false;

/**
 * Returns the keys whose values differ between two states (by reference equality).
 * Works correctly for primitives (compared by value) and arrays/objects
 * (compared by reference — state updates must replace top-level values).
 * @param {LetterTilesState} prev
 * @param {LetterTilesState} next
 * @returns {(keyof LetterTilesState)[]}
 */
function computeChangedKeys(prev, next) {
  return /** @type {(keyof LetterTilesState)[]} */ (Object.keys(next).filter(k => prev[k] !== next[k]));
}

/** @type {LetterTilesState} */
let currentState = {
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

/** @type {((state: LetterTilesState) => void)|null} */
let stateApplier = null;

/**
 * @param {(keyof LetterTilesState)[]} changedKeys
 */
function notifyListeners(changedKeys) {
  const snapshot = currentState;
  listeners.forEach(fn => {
    try { fn(snapshot, changedKeys); } catch(e) { /* listener errors don't break app */ }
  });
}

/**
 * Register a listener called whenever the app state changes.
 * Returns an unsubscribe function.
 * @param {ChangeListener} listener
 * @returns {() => void}
 */
export function addChangeListener(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Returns the current state of the app.
 * @returns {LetterTilesState}
 */
export function getState() {
  return currentState;
}

/**
 * Apply a new state to the app, rendering it accordingly.
 * Set notify=false (default) when applying remote state to avoid echo loops.
 * @param {LetterTilesState} state
 * @param {boolean} [notify=false]
 */
export function setState(state, notify = false) {
  const prev = currentState;
  currentState = state;
  if (stateApplier) {
    suppressNotifications = !notify;
    stateApplier(state);
    suppressNotifications = false;
  }
  if (notify) {
    notifyListeners(computeChangedKeys(prev, state));
  }
}

/**
 * @internal Called by the app to push state outward on local changes.
 * @param {LetterTilesState} state
 */
export function _notifyStateChanged(state) {
  const prev = currentState;
  currentState = state;
  if (!suppressNotifications) {
    notifyListeners(computeChangedKeys(prev, state));
  }
}

/**
 * @internal Called by the app to register its state applier.
 * @param {(state: LetterTilesState) => void} applier
 * @returns {() => void}
 */
export function _registerStateApplier(applier) {
  stateApplier = applier;
  return () => { if (stateApplier === applier) stateApplier = null; };
}

// Expose on window for easy external access
window.letterTilesSync = { addChangeListener, getState, setState };
