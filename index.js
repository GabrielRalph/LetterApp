import "./tile-data.js"
import { addChangeListener, getState, setState } from './sync.js';
import "./components/canvas-area.js"
import "./components/canvas-tile.js"
import "./components/drawing-layer.js"
import "./components/dictionary-panel.js"
import "./components/tile-palette.js"
import "./components/word-bank-panel.js"
import "./components/app-toolbar.js"
import "./app.js"
import { deserializeKey, serializeKey } from "./codec.js";


if (window.SquidlyAPI) {

    // ── Write throttle ────────────────────────────────────────────────────────
    // Firebase allows 20 writes/sec. tile-drag-move fires at pointer-event rate
    // (~60fps), so we must throttle per-key. A trailing-edge throttle ensures
    // the final value (e.g. drag-end position) is always flushed.
    const WRITE_INTERVAL_MS = 55; // slightly above 50 ms to stay safely under 20/s
    const lastWriteAt = {};
    const pendingTimer = {};

    function scheduleWrite(key, value) {
        const age = Date.now() - (lastWriteAt[key] ?? 0);
        clearTimeout(pendingTimer[key]);
        if (age >= WRITE_INTERVAL_MS) {
            lastWriteAt[key] = Date.now();
            SquidlyAPI.firebaseSet(key, value);
        } else {
            // Defer to the end of the throttle window so the latest value
            // (e.g. final drag position) is always written.
            pendingTimer[key] = setTimeout(() => {
                lastWriteAt[key] = Date.now();
                SquidlyAPI.firebaseSet(key, value);
            }, WRITE_INTERVAL_MS - age);
        }
    }

    addChangeListener((newState, keys) => {
        for (const k of keys) {
            scheduleWrite(k, serializeKey(k, newState[k]));
        }
    });

    // ── Incoming Firebase updates ─────────────────────────────────────────────
    // Remote state is always applied. Visual interruption during group drag is
    // handled in app.js (render is skipped while groupDrag is active).
    [
        "tiles",
        "paths",
        "mode",
        "selectedIds",
        "lookedUpWord",
        "isDictionaryOpen",
        "wordBank",
        "isWordBankOpen",
        "activePaletteTab",
        "dragPosition",
    ].forEach(key => {
        SquidlyAPI.firebaseOnValue(key, str => {
            const value = deserializeKey(key, str);
            setState({ ...getState(), [key]: value });
        });
    });
}