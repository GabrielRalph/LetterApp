/**
 * <canvas-tile> - A draggable tile on the canvas
 * Attributes: instance-id, grapheme, x, y, uppercase, selected
 */
const TILE_SIZE = 117;

class CanvasTileElement extends HTMLElement {
  static get observedAttributes() {
    return ['x', 'y', 'grapheme', 'uppercase', 'selected'];
  }

  constructor() {
    super();
    this._drag = null;
  }

  connectedCallback() {
    this._updatePosition();
    this._updateContent();
    this._updateSelection();
    this.addEventListener('pointerdown', this._onPointerDown);
    this.addEventListener('pointermove', this._onPointerMove);
    this.addEventListener('pointerup', this._onPointerUp);
    this.addEventListener('pointercancel', this._onPointerUp);
    this.addEventListener('click', this._onClick);
    this.addEventListener('dblclick', this._onDblClick);
  }

  disconnectedCallback() {
    this.removeEventListener('pointerdown', this._onPointerDown);
    this.removeEventListener('pointermove', this._onPointerMove);
    this.removeEventListener('pointerup', this._onPointerUp);
    this.removeEventListener('pointercancel', this._onPointerUp);
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('dblclick', this._onDblClick);
  }

  attributeChangedCallback(name) {
    if (name === 'x' || name === 'y') this._updatePosition();
    if (name === 'grapheme' || name === 'uppercase') this._updateContent();
    if (name === 'selected') this._updateSelection();
  }

  _updatePosition() {
    if (!this._drag) {
      this.style.left = this.getAttribute('x') + 'px';
      this.style.top = this.getAttribute('y') + 'px';
    }
  }

  _updateContent() {
    const g = this.getAttribute('grapheme') || '';
    const upper = this.hasAttribute('uppercase');
    const text = upper ? g.toUpperCase() : g;
    this.textContent = text;
    const len = text.length;
    this.style.fontSize = len > 5 ? '21px' : len > 4 ? '25px' : len > 3 ? '29px' : len > 2 ? '34px' : '44px';
  }

  _updateSelection() {
    if (this.hasAttribute('selected')) {
      this.classList.add('selected');
    } else {
      this.classList.remove('selected');
    }
  }

  _onPointerDown = (e) => {
    e.stopPropagation();
    this.setPointerCapture(e.pointerId);
    this._drag = {
      startX: e.clientX,
      startY: e.clientY,
      tileX: parseFloat(this.getAttribute('x')) || 0,
      tileY: parseFloat(this.getAttribute('y')) || 0,
      moved: false,
    };
    this.classList.add('dragging');
    this.dispatchEvent(new CustomEvent('tile-drag-start', {
      bubbles: true,
      detail: { instanceId: this.getAttribute('instance-id') }
    }));
  };

  _onPointerMove = (e) => {
    if (!this._drag) return;
    const dx = e.clientX - this._drag.startX;
    const dy = e.clientY - this._drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._drag.moved = true;
    const rawX = this._drag.tileX + dx;
    const rawY = this._drag.tileY + dy;
    this.style.left = rawX + 'px';
    this.style.top = rawY + 'px';
    this.dispatchEvent(new CustomEvent('tile-drag-move', {
      bubbles: true,
      detail: { instanceId: this.getAttribute('instance-id'), x: rawX, y: rawY }
    }));
  };

  _onPointerUp = (e) => {
    if (!this._drag) return;
    this.releasePointerCapture(e.pointerId);
    const dx = e.clientX - this._drag.startX;
    const dy = e.clientY - this._drag.startY;
    const finalX = this._drag.tileX + dx;
    const finalY = this._drag.tileY + dy;
    const moved = this._drag.moved;
    this._drag = null;
    this.classList.remove('dragging');
    this.dispatchEvent(new CustomEvent('tile-drag-end', {
      bubbles: true,
      detail: { instanceId: this.getAttribute('instance-id'), x: finalX, y: finalY, moved }
    }));
  };

  _onClick = (e) => {
    e.stopPropagation();
    if (this._drag && this._drag.moved) return;
    this.dispatchEvent(new CustomEvent('tile-click', {
      bubbles: true,
      detail: { instanceId: this.getAttribute('instance-id') }
    }));
  };

  _onDblClick = (e) => {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('tile-dblclick', {
      bubbles: true,
      detail: { instanceId: this.getAttribute('instance-id') }
    }));
  };
}

customElements.define('canvas-tile', CanvasTileElement);
export { TILE_SIZE };
