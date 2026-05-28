/**
 * <word-bank-panel> - Side panel listing saved words
 */
class WordBankPanelElement extends HTMLElement {
  constructor() {
    super();
    this._words = [];
  }

  get words() { return this._words; }

  set words(w) {
    this._words = w;
    this._render();
  }

  open() { this.classList.add('open'); }
  close() { this.classList.remove('open'); }
  get isOpen() { return this.classList.contains('open'); }

  _render() {
    const listHtml = this._words.length === 0
      ? `<p class="wb-empty">Add words above. Tap a word to place its tiles on the canvas.</p>`
      : this._words.map(w => `
          <div class="wb-word">
            <button class="wb-word-label" data-word="${w}">${w}</button>
            <button class="wb-place-btn" data-word="${w}" title="Place on canvas"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right w-5 h-5" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></button>
            <button class="wb-remove-btn" data-word="${w}" title="Remove"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x w-4 h-4" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>
          </div>
        `).join('');

    this.innerHTML = `
      <div class="wb-header">Word Bank</div>
      <div class="wb-input-row">
        <input class="wb-input" placeholder="Type a word..." />
        <button class="wb-add-btn">+</button>
      </div>
      <div class="wb-list">${listHtml}</div>
    `;

    const input = this.querySelector('.wb-input');
    const addBtn = this.querySelector('.wb-add-btn');

    const doAdd = () => {
      const val = input.value.trim().toLowerCase().replace(/[^a-z'\-]/g, '');
      if (!val || this._words.includes(val)) return;
      input.value = '';
      this.dispatchEvent(new CustomEvent('word-add', { bubbles: true, detail: { word: val } }));
    };

    addBtn.addEventListener('click', doAdd);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });

    this.querySelectorAll('.wb-word-label, .wb-place-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('word-place', { bubbles: true, detail: { word: btn.dataset.word } }));
      });
    });

    this.querySelectorAll('.wb-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('word-remove', { bubbles: true, detail: { word: btn.dataset.word } }));
      });
    });
  }
}

customElements.define('word-bank-panel', WordBankPanelElement);
