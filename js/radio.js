// ============================================================================
// RADIO SYSTEM – A Cloud for Maybel
// Overlay mit 4 Reglern (Master, Musik, Ambient, Effekte).
// Einstellungen werden in localStorage gespeichert.
// ============================================================================

const RADIO_STORAGE_KEY = 'cfm_radio_settings';

const RADIO_SLIDERS = [
  { key: 'master',  label: 'Master',  emoji: '🔊' },
  { key: 'music',   label: 'Musik',   emoji: '🎵' },
  { key: 'ambient', label: 'Umgebung',emoji: '🌿' },
  { key: 'sfx',     label: 'Effekte', emoji: '✨' },
];

class RadioSystem {
  constructor() {
    this.visible  = false;
    this.audio    = null;   // Referenz auf AudioSystem, wird von game.js gesetzt

    // Slider-Drag-State
    this._dragging = null;  // { key, startX, startVal }

    // Overlay-Layout (berechnet in draw)
    this._layout = null;
  }

  // -------------------------------------------------------------------------
  // Settings laden/speichern
  // -------------------------------------------------------------------------
  loadSettings() {
    try {
      const raw = localStorage.getItem(RADIO_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  saveSettings(vol) {
    try { localStorage.setItem(RADIO_STORAGE_KEY, JSON.stringify(vol)); } catch {}
  }

  // -------------------------------------------------------------------------
  // Öffnen/Schließen
  // -------------------------------------------------------------------------
  open() {
    this.visible = true;
  }

  close() {
    this.visible = false;
    this._dragging = null;
  }

  toggle() {
    this.visible ? this.close() : this.open();
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------
  handleMouseDown(x, y) {
    if (!this.visible || !this._layout) return false;

    // Schließen-Button
    const cb = this._layout.closeBtn;
    if (x >= cb.x && x <= cb.x + cb.w && y >= cb.y && y <= cb.y + cb.h) {
      this.close();
      return true;
    }

    // Slider anklicken
    for (const s of this._layout.sliders) {
      if (x >= s.trackX && x <= s.trackX + s.trackW &&
          y >= s.y - 10  && y <= s.y + 20) {
        this._dragging = { key: s.key };
        this._updateSlider(s.key, x);
        return true;
      }
    }

    // Klick außerhalb → schließen
    const box = this._layout.box;
    if (x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h) {
      this.close();
      return true;
    }

    return true;
  }

  handleMouseMove(x, y) {
    if (!this.visible || !this._dragging || !this._layout) return false;
    this._updateSlider(this._dragging.key, x);
    return true;
  }

  handleMouseUp() {
    if (!this._dragging) return false;
    this._dragging = null;
    return true;
  }

  _updateSlider(key, mouseX) {
    if (!this._layout || !this.audio) return;
    const s = this._layout.sliders.find(s => s.key === key);
    if (!s) return;
    const val = Math.max(0, Math.min(1, (mouseX - s.trackX) / s.trackW));
    this.audio.setVolume(key, val);
    this.saveSettings(this.audio.vol);
  }

  // -------------------------------------------------------------------------
  // Draw
  // -------------------------------------------------------------------------
  draw(ctx) {
    if (!this.visible || !this.audio) return;

    const bw = 340, bh = 280;
    const bx = (CANVAS_WIDTH  - bw) / 2;
    const by = (CANVAS_HEIGHT - bh) / 2;
    const PAD = 24;

    // Layout berechnen
    const sliderLayouts = RADIO_SLIDERS.map((s, i) => ({
      key:    s.key,
      label:  s.label,
      emoji:  s.emoji,
      trackX: bx + PAD + 90,
      trackW: bw - PAD * 2 - 90 - 36,
      y:      by + 70 + i * 46,
    }));

    this._layout = {
      box:      { x: bx, y: by, w: bw, h: bh },
      sliders:  sliderLayouts,
      closeBtn: { x: bx + bw - 32, y: by + 8, w: 24, h: 24 },
    };

    ctx.save();

    // Overlay-Hintergrund
    ctx.fillStyle   = 'rgba(10,10,30,0.95)';
    ctx.strokeStyle = 'rgba(255,220,80,0.6)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 14);
    ctx.fill();
    ctx.stroke();

    // Titel
    ctx.font      = 'bold 16px sans-serif';
    ctx.fillStyle = '#ffe080';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('📻 Radio', bx + bw / 2, by + PAD);

    // Schließen-Button
    const cb = this._layout.closeBtn;
    ctx.font      = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', cb.x + cb.w / 2, cb.y + cb.h / 2);

    // Slider
    for (const s of sliderLayouts) {
      const val = this.audio.vol[s.key] ?? 1;

      // Label
      ctx.font      = '13px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${s.emoji} ${s.label}`, bx + PAD, s.y + 6);

      // Track Hintergrund
      ctx.fillStyle   = 'rgba(255,255,255,0.12)';
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(s.trackX, s.y, s.trackW, 10, 5);
      ctx.fill();
      ctx.stroke();

      // Track Füllung
      const fillW = s.trackW * val;
      if (fillW > 0) {
        const grad = ctx.createLinearGradient(s.trackX, 0, s.trackX + s.trackW, 0);
        grad.addColorStop(0, '#ffe080');
        grad.addColorStop(1, '#ffb030');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(s.trackX, s.y, fillW, 10, 5);
        ctx.fill();
      }

      // Knopf
      const knobX = s.trackX + s.trackW * val;
      ctx.fillStyle   = '#fff';
      ctx.strokeStyle = '#ffe080';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(knobX, s.y + 5, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Prozentwert
      ctx.font      = '11px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(val * 100)}%`, bx + bw - PAD + 10, s.y + 5);
    }

    ctx.restore();
  }
}
