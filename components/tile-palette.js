/**
 * <tile-palette> - Bottom ribbon with tabs of draggable tiles
 */
import { TILE_DATA } from '../tile-data.js';

const TAB_LABELS = {
  vowel: 'Vowels',
  consonant: 'Consonants',
  digraph: 'Digraphs',
  'vowel-digraph': 'Vowel Digraphs',
  trigraph: 'Trigraphs',
  blend: 'Blends',
  affix: 'Affixes',
  punctuation: 'Punctuation',
};

class TilePaletteElement extends HTMLElement {
  constructor() {
    super();
    this._activeTab = 0;
    this._dragTile = null;
  }

  connectedCallback() {
    this._render();
  }

  get activeTab() { return this._activeTab; }
  set activeTab(idx) {
    this._activeTab = idx;
    this._render();
  }

  /** Returns the tile def being dragged from the palette (if any) */
  get dragTile() { return this._dragTile; }

  _render() {
    const sets = TILE_DATA.tileSets;
    if (!sets.length) {
      this.innerHTML = `<div style="height:104px;display:flex;align-items:center;justify-content:center;background:#f5c518;font-weight:700;color:#7a6000;font-size:21px">Loading tiles...</div>`;
      return;
    }

    const tabsHtml = sets.map((s, i) => {
      const cls = i === this._activeTab ? 'tab-btn active' : 'tab-btn';
      const label = TAB_LABELS[s.category] || s.name;
      return `<button class="${cls}" data-tab="${i}">${label}</button>`;
    }).join('');

    const activeSet = sets[this._activeTab] || sets[0];
    const tilesHtml = activeSet.tiles.map((tile, i) => {
      const g = tile.grapheme;
      const len = g.length;
      const fs = len > 5 ? '16px' : len > 4 ? '18px' : len > 3 ? '22px' : len > 2 ? '26px' : '34px';
      return `<div class="palette-tile" draggable="true" data-tile-idx="${i}" style="font-size:${fs}">${g}</div>`;
    }).join('');

    this.innerHTML = `
      <div class="tab-row">${tabsHtml}</div>
      <div class="tile-grid">${tilesHtml}</div>
    `;

    // Tab click handlers
    this.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.tab);
        this._activeTab = idx;
        this._render();
        this.dispatchEvent(new CustomEvent('palette-tab-change', {
          bubbles: true,
          detail: { tab: idx }
        }));
      });
    });

    // Tile drag handlers
    this.querySelectorAll('.palette-tile').forEach(el => {
      el.addEventListener('dragstart', (e) => {
        const idx = parseInt(el.dataset.tileIdx);
        this._dragTile = activeSet.tiles[idx];
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', this._dragTile.grapheme);
      });
      el.addEventListener('dragend', () => {
        setTimeout(() => { this._dragTile = null; }, 100);
      });
    });
  }
}

customElements.define('tile-palette', TilePaletteElement);
