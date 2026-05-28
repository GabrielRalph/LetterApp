/**
 * <dictionary-panel> - Side panel for word lookup using the free dictionary API
 */
class DictionaryPanelElement extends HTMLElement {
  constructor() {
    super();
    this._word = null;
    this._isOpen = false;
  }

  get isOpen() { return this._isOpen; }

  open(word) {
    this._word = word;
    this._isOpen = true;
    this.classList.add('open');
    this._fetchDefinition(word);
  }

  close() {
    this._isOpen = false;
    this._word = null;
    this.classList.remove('open');
  }

  async _fetchDefinition(word) {
    if (!word) {
      this._renderEmpty();
      return;
    }
    this._renderLoading(word);
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      this._renderEntry(data[0]);
    } catch {
      this._renderError(word);
    }
  }

  _renderLoading(word) {
    this.innerHTML = `
      <div class="panel-header">
        <h2>📖 Dictionary</h2>
        <button class="panel-close">&times;</button>
      </div>
      <div class="panel-body">
        <p style="color:#64748b;margin-top:40px;text-align:center">Looking up "${word}"...</p>
      </div>
    `;
    this._bindClose();
  }

  _renderEmpty() {
    this.innerHTML = `
      <div class="panel-header">
        <h2>📖 Dictionary</h2>
        <button class="panel-close">&times;</button>
      </div>
      <div class="panel-body">
        <p class="empty-msg">Select a word to look up</p>
      </div>
    `;
    this._bindClose();
  }

  _renderError(word) {
    this.innerHTML = `
      <div class="panel-header">
        <h2>📖 Dictionary</h2>
        <button class="panel-close">&times;</button>
      </div>
      <div class="panel-body">
        <div class="error-msg">Could not find definition for "${word}".</div>
      </div>
    `;
    this._bindClose();
  }

  _renderEntry(entry) {
    const phonetic = entry.phonetic || '';
    const audioUrl = entry.phonetics?.find(p => p.audio)?.audio || '';

    let meaningsHtml = '';
    for (const meaning of (entry.meanings || [])) {
      const defs = meaning.definitions.slice(0, 3).map(d => {
        let html = `<li class="definition">${d.definition}`;
        if (d.example) html += `<p class="example">"${d.example}"</p>`;
        html += '</li>';
        return html;
      }).join('');
      meaningsHtml += `
        <div style="margin-top:16px">
          <span class="pos-label">${meaning.partOfSpeech}</span>
          <ol style="margin-top:8px;padding-left:20px">${defs}</ol>
        </div>
      `;
    }

    this.innerHTML = `
      <div class="panel-header">
        <h2>📖 Dictionary</h2>
        <button class="panel-close">&times;</button>
      </div>
      <div class="panel-body">
        <div class="word-title">${entry.word}</div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          ${phonetic ? `<span class="phonetic">${phonetic}</span>` : ''}
          ${audioUrl ? `<button class="listen-btn" data-audio="${audioUrl}">▶ Listen</button>` : ''}
        </div>
        ${meaningsHtml}
      </div>
    `;
    this._bindClose();
    const listenBtn = this.querySelector('.listen-btn');
    if (listenBtn) {
      listenBtn.addEventListener('click', () => {
        new Audio(listenBtn.dataset.audio).play();
      });
    }
  }

  _bindClose() {
    const btn = this.querySelector('.panel-close');
    if (btn) btn.addEventListener('click', () => {
      this.close();
      this.dispatchEvent(new CustomEvent('dictionary-close', { bubbles: true }));
    });
  }
}

customElements.define('dictionary-panel', DictionaryPanelElement);
