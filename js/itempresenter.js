// ============================================================================
// ITEM PRESENTER – A Cloud for ...
// Präsentiert ein neu eingesammeltes Item:
//  1. Item wächst vom Fundort zur Bildschirmmitte (mit Rahmen + Beschreibung)
//  2. Klick → Item schrumpft und fliegt zum richtigen Inventar-Slot
// ============================================================================

const PRESENTER_GROW_MS  = 400;   // Dauer Einblend-Animation
const PRESENTER_FLY_MS   = 500;   // Dauer Flug-Animation zum Slot
const PRESENTER_SIZE     = 180;   // Präsentationsgröße des Items (px)
const PRESENTER_BOX_PAD  = 32;    // Padding um Item herum

class ItemPresenter {
  constructor() {
    this.active    = false;
    this._phase    = null;   // 'grow' | 'show' | 'fly'
    this._timer    = 0;

    this._item     = null;   // das Item-Objekt
    this._itemDef  = null;   // die Item-Definition (für Beschreibung)
    this._img      = null;   // vorgeladenes Bild

    // Startposition (Fundort im Canvas)
    this._fromX    = 0;
    this._fromY    = 0;

    // Zielposition (Inventar-Slot)
    this._toX      = 0;
    this._toY      = 0;

    // Aktuelle Darstellungsgröße und Position
    this._curX     = 0;
    this._curY     = 0;
    this._curSize  = 0;
    this._alpha    = 0;

    this._onDone   = null;   // Callback wenn Animation fertig
  }

  // -------------------------------------------------------------------------
  // Starten
  // fromX/fromY  = Fundort des Items in Canvas-Koordinaten
  // slotPos      = { x, y } Mitte des Ziel-Slots
  // -------------------------------------------------------------------------
  present(item, itemDef, img, fromX, fromY, slotPos, onDone) {
    this._item    = item;
    this._itemDef = itemDef;
    this._img     = img;
    this._fromX   = fromX;
    this._fromY   = fromY;
    this._toX     = slotPos.x;
    this._toY     = slotPos.y;
    this._onDone  = onDone;

    this._phase   = 'grow';
    this._timer   = 0;
    this._curX    = fromX;
    this._curY    = fromY;
    this._curSize = 0;
    this._alpha   = 0;
    this._clickLock = true;  // Verhindert sofortiges Wegklicken
    setTimeout(() => { this._clickLock = false; }, 600);
    this.active   = true;
  }

  // -------------------------------------------------------------------------
  // Klick → Fly-Phase starten
  // -------------------------------------------------------------------------
  handleClick() {
    if (!this.active) return false;
    if (this._clickLock) return true;  // Klick schlucken aber ignorieren
    if (this._phase === 'show' || this._phase === 'grow') {
      this._phase = 'fly';
      this._timer = 0;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  update(deltaTime) {
    if (!this.active) return;
    this._timer += deltaTime;

    if (this._phase === 'grow') {
      const t = Math.min(1, this._timer / PRESENTER_GROW_MS);
      const e = this._easeOut(t);

      // Von Fundort zur Mitte wachsen
      const cx = CANVAS_WIDTH  / 2;
      const cy = CANVAS_HEIGHT / 2 - 40;
      this._curX    = this._fromX + (cx - this._fromX) * e;
      this._curY    = this._fromY + (cy - this._fromY) * e;
      this._curSize = PRESENTER_SIZE * e;
      this._alpha   = e;

      if (t >= 1) { this._phase = 'show'; this._timer = 0; }
    }

    else if (this._phase === 'fly') {
      const t = Math.min(1, this._timer / PRESENTER_FLY_MS);
      const e = this._easeIn(t);

      // Von Mitte zum Slot fliegen und schrumpfen
      const cx = CANVAS_WIDTH  / 2;
      const cy = CANVAS_HEIGHT / 2 - 40;
      this._curX    = cx + (this._toX - cx) * e;
      this._curY    = cy + (this._toY - cy) * e;
      this._curSize = PRESENTER_SIZE * (1 - e) + (SLOT_SIZE - 12) * e;
      this._alpha   = 1 - e * 0.3;

      if (t >= 1) {
        this.active  = false;
        this._phase  = null;
        if (this._onDone) this._onDone();
      }
    }
  }

  // -------------------------------------------------------------------------
  // Zeichnen
  // -------------------------------------------------------------------------
  draw(ctx) {
    if (!this.active) return;

    ctx.save();
    ctx.globalAlpha = this._alpha;

    const cx   = this._curX;
    const cy   = this._curY;
    const size = this._curSize;

    if (this._phase === 'grow' || this._phase === 'show') {
      // Dunkles Overlay
      ctx.globalAlpha = this._alpha * 0.6;
      ctx.fillStyle   = 'rgba(0,0,0,1)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Rahmen
      const boxW = PRESENTER_SIZE + PRESENTER_BOX_PAD * 2;
      const boxH = PRESENTER_SIZE + PRESENTER_BOX_PAD * 2 + 80; // +80 für Text
      const boxX = cx - boxW / 2;
      const boxY = cy - PRESENTER_SIZE / 2 - PRESENTER_BOX_PAD;

      ctx.globalAlpha = this._alpha * 0.85;
      ctx.fillStyle   = 'rgba(10,6,20,0.92)';
      ctx.strokeStyle = 'rgba(180,140,80,0.6)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 14);
      ctx.fill();
      ctx.stroke();

      // Goldener Innenrahmen
      ctx.strokeStyle = 'rgba(180,140,80,0.2)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(boxX + 6, boxY + 6, boxW - 12, boxH - 12, 10);
      ctx.stroke();

      // Item-Bild
      ctx.globalAlpha = this._alpha;
      if (this._img && this._img.complete && this._img.naturalWidth > 0) {
        ctx.drawImage(this._img, cx - size / 2, cy - size / 2, size, size);
      } else {
        ctx.font         = `${size * 0.6}px serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle    = '#fff';
        ctx.fillText(this._item?.emoji || '?', cx, cy);
      }

      // Item-Name
      ctx.globalAlpha  = this._alpha;
      ctx.font         = 'bold 18px Georgia, serif';
      ctx.fillStyle    = '#ffe090';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(this._item?.label || '', cx, boxY + PRESENTER_SIZE + PRESENTER_BOX_PAD + 10);

      // Beschreibung
      if (this._itemDef?.description) {
        ctx.font      = '13px Georgia, serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        this._wrapText(ctx, this._itemDef.description, cx, boxY + PRESENTER_SIZE + PRESENTER_BOX_PAD + 36, boxW - 24, 18);
      }

      // Hinweis "Klicken zum Weiter"
      if (this._phase === 'show') {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 600);
        ctx.globalAlpha = this._alpha * (0.4 + 0.6 * pulse);
        ctx.font        = '11px sans-serif';
        ctx.fillStyle   = 'rgba(200,180,255,0.9)';
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('[ Klicken zum Weiter ]', cx, boxY + boxH - 8);
      }

    } else if (this._phase === 'fly') {
      // Nur das Item — fliegt zum Slot
      ctx.globalAlpha = this._alpha;
      if (this._img && this._img.complete && this._img.naturalWidth > 0) {
        ctx.drawImage(this._img, cx - size / 2, cy - size / 2, size, size);
      } else {
        ctx.font         = `${Math.max(12, size * 0.6)}px serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle    = '#fff';
        ctx.fillText(this._item?.emoji || '?', cx, cy);
      }
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Hilfsmethoden
  // -------------------------------------------------------------------------
  _wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, curY);
        curY += lineH;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, curY);
  }

  _easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  _easeIn(t)  { return t * t * t; }
}
