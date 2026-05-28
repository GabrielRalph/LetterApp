/**
 * <app-toolbar> - Bottom control bar with tools, word display, chips
 */

// SVG icon paths
const ICONS = {
  pointer: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>`,
  pen: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  eraser: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`,
  trash: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  clear: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>`,
  book: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  volume: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  wordbank: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="m10 2 0 20"/></svg>`,
};

class AppToolbarElement extends HTMLElement {
  constructor() {
    super();
    this._mode = 'select';
    this._activeWord = '';
    this._wordGroups = [];
    this._tileCount = 0;
    this._selectedCount = 0;
    this._isWordBankOpen = false;
  }

  update({ mode, activeWord, wordGroups, tileCount, selectedCount, isWordBankOpen }) {
    this._mode = mode;
    this._activeWord = activeWord;
    this._wordGroups = wordGroups;
    this._tileCount = tileCount;
    this._selectedCount = selectedCount;
    this._isWordBankOpen = isWordBankOpen;
    this._render();
  }

  _render() {
    const hasSelection = this._selectedCount > 0;

    const wordSection = `
      <div class="word-display">
        <span>Word</span>
        <input class="word-input" readonly value="${this._activeWord}" placeholder="Select a word..." />
        ${this._activeWord ? `
          <button class="speak-btn" title="Read aloud">${ICONS.volume}</button>
          <button class="lookup-btn" title="Look up">${ICONS.book}</button>
        ` : ''}
      </div>
    `;

    const chips = this._wordGroups.map(g =>
      `<button class="word-chip" data-word="${g.text}">${g.text}</button>`
    ).join('');

    const tileCountSection = `
      <div class="tile-count">
        <span class="label">Tiles</span>
        <span class="count">${this._tileCount}</span>
        ${hasSelection ? `<span class="sel">${this._selectedCount} sel</span>` : ''}
      </div>
    `;

    const toolBtns = `
      <button class="tool-btn ${this._mode === 'select' ? 'active' : ''}" data-tool="select" title="Select">${ICONS.pointer}</button>
      <button class="tool-btn ${this._mode === 'draw' ? 'active' : ''}" data-tool="draw" title="Draw">${ICONS.pen}</button>
      <button class="tool-btn ${this._mode === 'eraser' ? 'active' : ''}" data-tool="eraser" title="Erase">${ICONS.eraser}</button>
      <div class="divider"></div>
      ${hasSelection ? `<button class="tool-btn danger" data-action="delete" title="Delete selected">${ICONS.trash}</button>` : ''}
      ${hasSelection ? `<button class="tool-btn" data-action="toggle-case" title="Toggle case"><span style="font-size:22px;font-weight:900">Aa</span></button>` : ''}
      <div class="divider"></div>
      <button class="tool-btn ${this._isWordBankOpen ? 'active' : ''}" data-action="toggle-wordbank" title="Word Bank">${ICONS.wordbank}</button>
      <button class="tool-btn danger" data-action="clear" title="Clear canvas">${ICONS.clear}</button>
    `;

    this.innerHTML = `
      ${wordSection}
      <div class="divider"></div>
      <div class="word-chips">${chips}</div>
      <div class="divider"></div>
      ${tileCountSection}
      <div class="divider"></div>
      <span style="font-size:20px;font-weight:800;color:#6b4c00;flex-shrink:0">Tools</span>
      ${toolBtns}
    `;

    // Event bindings
    this.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('tool-change', { bubbles: true, detail: { mode: btn.dataset.tool } }));
      });
    });

    this.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('toolbar-action', { bubbles: true, detail: { action: btn.dataset.action } }));
      });
    });

    this.querySelectorAll('.word-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('lookup-word', { bubbles: true, detail: { word: btn.dataset.word } }));
      });
    });

    const speakBtn = this.querySelector('.speak-btn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(this._activeWord));
        }
      });
    }

    const lookupBtn = this.querySelector('.lookup-btn');
    if (lookupBtn) {
      lookupBtn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('lookup-word', { bubbles: true, detail: { word: this._activeWord } }));
      });
    }
  }
}

customElements.define('app-toolbar', AppToolbarElement);
