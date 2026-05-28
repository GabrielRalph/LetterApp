/**
 * <drawing-layer> - SVG overlay for freehand drawing/erasing
 */
class DrawingLayerElement extends HTMLElement {
  constructor() {
    super();
    this._currentPath = null;
    this._mode = 'select';
    this._svg = null;
  }

  connectedCallback() {
    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.style.width = '100%';
    this._svg.style.height = '100%';
    this._svg.style.position = 'absolute';
    this._svg.style.inset = '0';
    this.appendChild(this._svg);
    this._svg.addEventListener('pointerdown', this._onPointerDown);
    this._svg.addEventListener('pointermove', this._onPointerMove);
    this._svg.addEventListener('pointerup', this._onPointerUp);
    this._svg.addEventListener('pointercancel', this._onPointerUp);
  }

  set mode(m) {
    this._mode = m;
    this._svg.style.pointerEvents = m === 'select' ? 'none' : 'auto';
    this._svg.style.touchAction = 'none';
  }

  get mode() { return this._mode; }

  renderPaths(paths) {
    // Keep only the static group, rebuild
    const existing = this._svg.querySelector('.static-paths');
    if (existing) existing.remove();
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('static-paths');
    for (const path of paths) {
      if (path.points.length < 2) continue;
      const d = path.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', d);
      el.setAttribute('stroke', path.color);
      el.setAttribute('stroke-width', path.width);
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke-linecap', 'round');
      el.setAttribute('stroke-linejoin', 'round');
      g.appendChild(el);
    }
    this._svg.prepend(g);
  }

  _getCursorPoint(e) {
    const pt = this._svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(this._svg.getScreenCTM().inverse());
  }

  _onPointerDown = (e) => {
    if (this._mode === 'select') return;
    const pt = this._getCursorPoint(e);
    this._svg.setPointerCapture(e.pointerId);

    if (this._mode === 'draw') {
      this._currentPath = {
        id: Math.random().toString(36).slice(2, 10),
        points: [{ x: pt.x, y: pt.y }],
        color: '#E53935',
        width: 4,
      };
      this._liveEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this._liveEl.setAttribute('stroke', '#E53935');
      this._liveEl.setAttribute('stroke-width', '4');
      this._liveEl.setAttribute('fill', 'none');
      this._liveEl.setAttribute('stroke-linecap', 'round');
      this._liveEl.setAttribute('stroke-linejoin', 'round');
      this._svg.appendChild(this._liveEl);
    } else if (this._mode === 'eraser') {
      this._eraseNear(pt.x, pt.y);
    }
  };

  _onPointerMove = (e) => {
    const pt = this._getCursorPoint(e);
    if (this._mode === 'draw' && this._currentPath) {
      this._currentPath.points.push({ x: pt.x, y: pt.y });
      const d = this._currentPath.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      this._liveEl.setAttribute('d', d);
    } else if (this._mode === 'eraser' && (e.buttons > 0)) {
      this._eraseNear(pt.x, pt.y);
    }
  };

  _onPointerUp = (e) => {
    this._svg.releasePointerCapture(e.pointerId);
    if (this._currentPath) {
      if (this._liveEl) { this._liveEl.remove(); this._liveEl = null; }
      this.dispatchEvent(new CustomEvent('path-added', {
        bubbles: true,
        detail: { path: this._currentPath }
      }));
      this._currentPath = null;
    }
  };

  _eraseNear(x, y) {
    this.dispatchEvent(new CustomEvent('erase-near', {
      bubbles: true,
      detail: { x, y }
    }));
  }
}

customElements.define('drawing-layer', DrawingLayerElement);
