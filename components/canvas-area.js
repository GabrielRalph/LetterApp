/**
 * <canvas-area> - The main canvas where tiles are placed, dragged, and drawn on.
 */
import { TILE_SIZE } from './canvas-tile.js';

class CanvasAreaElement extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="canvas-inner">
        <div class="word-groups"></div>
        <div class="tiles-container"></div>
        <div class="snap-indicator"></div>
        <div class="drop-indicator"></div>
        <drawing-layer></drawing-layer>
      </div>
      <dictionary-panel></dictionary-panel>
    `;
    this._inner = this.querySelector('.canvas-inner');
    this._tilesContainer = this.querySelector('.tiles-container');
    this._wordGroupsEl = this.querySelector('.word-groups');
    this._snapInd = this.querySelector('.snap-indicator');
    this._dropInd = this.querySelector('.drop-indicator');
    this._drawingLayer = this.querySelector('drawing-layer');
    this._dictPanel = this.querySelector('dictionary-panel');

    this._snapInd.style.height = TILE_SIZE + 'px';
    this._dropInd.style.height = TILE_SIZE + 'px';

    this._inner.addEventListener('click', this._onCanvasClick);
    this._inner.addEventListener('dragover', this._onDragOver);
    this._inner.addEventListener('dragleave', this._onDragLeave);
    this._inner.addEventListener('drop', this._onDrop);
  }

  get drawingLayer() { return this._drawingLayer; }
  get dictionaryPanel() { return this._dictPanel; }
  get snapIndicator() { return this._snapInd; }
  get dropIndicator() { return this._dropInd; }

  renderTiles(tiles, selectedIds) {
    // Diff-based update for performance
    const existing = new Map();
    this._tilesContainer.querySelectorAll('canvas-tile').forEach(el => {
      existing.set(el.getAttribute('instance-id'), el);
    });

    const newIds = new Set(tiles.map(t => t.instanceId));

    // Remove tiles no longer present
    existing.forEach((el, id) => {
      if (!newIds.has(id)) el.remove();
    });

    // Add/update tiles
    for (const t of tiles) {
      let el = existing.get(t.instanceId);
      if (!el) {
        el = document.createElement('canvas-tile');
        el.setAttribute('instance-id', t.instanceId);
        this._tilesContainer.appendChild(el);
      }
      el.setAttribute('x', t.x);
      el.setAttribute('y', t.y);
      el.setAttribute('grapheme', t.tile.grapheme);
      if (t.uppercase) el.setAttribute('uppercase', '');
      else el.removeAttribute('uppercase');
      if (selectedIds.includes(t.instanceId)) el.setAttribute('selected', '');
      else el.removeAttribute('selected');
    }
  }

  renderWordGroups(groups) {
    this._wordGroupsEl.innerHTML = '';
    for (const g of groups) {
      const div = document.createElement('div');
      div.className = 'word-group-outline';
      div.style.left = (g.x - 3) + 'px';
      div.style.top = (g.y - 3) + 'px';
      div.style.width = (g.width + 8) + 'px';
      div.style.height = (TILE_SIZE + 8) + 'px';
      this._wordGroupsEl.appendChild(div);
    }
  }

  _onCanvasClick = (e) => {
    if (e.target.closest('canvas-tile')) return;
    this.dispatchEvent(new CustomEvent('canvas-click', { bubbles: true }));
  };

  _onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    this.dispatchEvent(new CustomEvent('canvas-dragover', {
      bubbles: true,
      detail: { clientX: e.clientX, clientY: e.clientY }
    }));
  };

  _onDragLeave = () => {
    this._dropInd.style.display = 'none';
  };

  _onDrop = (e) => {
    e.preventDefault();
    this._dropInd.style.display = 'none';
    const rect = this._inner.getBoundingClientRect();
    this.dispatchEvent(new CustomEvent('canvas-drop', {
      bubbles: true,
      detail: { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }));
  };
}

customElements.define('canvas-area', CanvasAreaElement);
