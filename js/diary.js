// ============================================================================
// TAGEBUCH – A Cloud for Maybel
// Overlay mit aufgeschlagenem Buch, 3 Kategorien (Reiter),
// Liste links / Eintrag rechts wie ein Dateimanager.
// Einträge werden automatisch befüllt wenn Logs gemacht werden.
// ============================================================================

const DIARY_BOOK_SRC = 'assets/ui/openBook.png';

const DIARY_CATEGORIES = ['Ereignisse', 'Items', 'Codes'];

// Positions/Größen
const DB = {
  x:  40,
  y:  20,
  w:  CANVAS_WIDTH  - 80,
  h:  CANVAS_HEIGHT - 40,
  tabH:    32,
  listW:   180,
  padding: 16,
};

// ============================================================================

class Diary {
  constructor() {
    this.visible      = false;
    this._tab         = 0;         // 0=Ereignisse, 1=Items, 2=Codes
    this._selected    = null;      // Index des gewählten Eintrags
    this._listScroll  = 0;
    this._bookImg     = null;
    this._entries     = {
      Ereignisse:  [],   // { title, text, timestamp }
      Items:       [],
      Codes:       [],
    };
    this._loadBookImage();
  }

  async loadPreset() {
  try {
    const res  = await fetch('scenes/diary_preset.json');    
    const data = await res.json();
    for (const cat of Object.keys(data)) {
      for (const entry of (data[cat] || [])) {
        // Preset-Einträge werden ans Ende gehängt (nicht vorne)
        if (!this._entries[cat].find(e => e.title === entry.title)) {
          this._entries[cat].push(entry);
        }
      }
    }
  } catch(e) {
    console.warn('diary_preset.json nicht gefunden');
  }
  console.log("DIARY LOADED:", this._entries);
}

  _loadBookImage() {
    const img  = new Image();
    img.onload = () => { this._bookImg = img; };
    img.src    = DIARY_BOOK_SRC;
  }

  // -------------------------------------------------------------------------
  // Einträge hinzufügen
  // -------------------------------------------------------------------------

  // Item gefunden / benutzt / kombiniert
  addItem(itemLabel, action, description = '') {
    const actionText = {
      found:    'eingesammelt',
      used:     'benutzt',
      combined: 'entstanden',
      lost:     'weggegeben',
    }[action] || action;

    this._add('Items', itemLabel, `${itemLabel} wurde ${actionText}.\n${description}`.trim());
  }

  // NPC-Gespräch
  addEvent(title, text) {
    this._add('Ereignisse', title, text);
  }

  // Code-Eintrag (z.B. Hinweis auf Minigame-Lösung)
  addCode(title, text) {
    this._add('Codes', title, text);
  }

  _add(category, title, text) {
    const list = this._entries[category];
    // Kein Duplikat (gleicher Titel)
    if (list.find(e => e.title === title)) return;
    list.unshift({
      title,
      text,
      timestamp: this._timestamp(),
    });
  }

  // -------------------------------------------------------------------------
  // Öffnen / Schließen
  // -------------------------------------------------------------------------
  toggle() {
    this.visible = !this.visible;
    if (this.visible) { this._selected = null; this._listScroll = 0; }
  }
  open()  { this.visible = true;  this._selected = null; this._listScroll = 0; }
  close() { this.visible = false; }

  iconHit(x, y) {
    const ix = CANVAS_WIDTH - 88, iy = 8;
    return x >= ix && x <= ix + 36 && y >= iy && y <= iy + 36;
  }

  // -------------------------------------------------------------------------
  // Klick
  // -------------------------------------------------------------------------
  handleClick(x, y) {
    if (!this.visible) return false;

    const { x: bx, y: by, w: bw, h: bh, tabH, listW, padding } = DB;

    // Schließen
    if (x >= bx + bw - 36 && x <= bx + bw - 8 && y >= by + 8 && y <= by + 8 + 24) {
      this.close(); return true;
    }

    // Reiter
    const tabW = bw / DIARY_CATEGORIES.length;
    if (y >= by + padding && y <= by + padding + tabH) {
      for (let i = 0; i < DIARY_CATEGORIES.length; i++) {
        const tx = bx + i * tabW;
        if (x >= tx && x <= tx + tabW) {
          this._tab = i;
          this._selected = null;
          this._listScroll = 0;
          return true;
        }
      }
    }

    // Liste links — Eintrag auswählen
    const listX  = bx + padding;
    const listY  = by + padding + tabH + 8;
    const listH  = bh - padding * 2 - tabH - 8;
    const itemH  = 40;

    if (x >= listX && x <= listX + listW && y >= listY && y <= listY + listH) {
      const entries = this._currentEntries();
      const relY    = y - listY + this._listScroll;
      const idx     = Math.floor(relY / itemH);
      if (idx >= 0 && idx < entries.length) {
        this._selected = idx;
      }
      return true;
    }

    // Scroll Liste
    if (x >= listX && x <= listX + listW) {
      if (y >= by + bh - 40 && y <= by + bh - 10) {
        this._listScroll += 40; return true;
      }
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // Zeichnen
  // -------------------------------------------------------------------------
  draw(ctx) {
    if (!this.visible) return;

    const { x: bx, y: by, w: bw, h: bh, tabH, listW, padding } = DB;

    ctx.save();

    // Buch-Hintergrund
    if (this._bookImg) {
      ctx.globalAlpha = 1;
      ctx.drawImage(this._bookImg, bx, by, bw, bh);
      // Leichte Abdunklung für Lesbarkeit
      ctx.fillStyle = 'rgba(10,6,20,0.55)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12); ctx.fill();
    } else {
      ctx.fillStyle   = 'rgba(18,10,30,0.97)';
      ctx.strokeStyle = 'rgba(180,140,80,0.5)';
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12);
      ctx.fill(); ctx.stroke();
    }

    // Schließen-Button
    ctx.font         = '16px sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.5)';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('✕', bx + bw - 10, by + 10);

    // --- Reiter ---
    const tabW = bw / DIARY_CATEGORIES.length;
    for (let i = 0; i < DIARY_CATEGORIES.length; i++) {
      const tx     = bx + i * tabW;
      const active = i === this._tab;
      ctx.fillStyle = active ? 'rgba(180,140,80,0.35)' : 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.roundRect(tx + 2, by + padding, tabW - 4, tabH, [6, 6, 0, 0]);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = 'rgba(180,140,80,0.5)';
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
      ctx.font         = `${active ? 'bold ' : ''}13px Georgia, serif`;
      ctx.fillStyle    = active ? '#ffe090' : 'rgba(255,255,255,0.5)';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(DIARY_CATEGORIES[i], tx + tabW / 2, by + padding + tabH / 2);
    }

    // Trennlinie unter Reitern
    ctx.strokeStyle = 'rgba(180,140,80,0.25)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(bx + padding, by + padding + tabH + 6);
    ctx.lineTo(bx + bw - padding, by + padding + tabH + 6);
    ctx.stroke();

    // --- Inhalt ---
    const contentY = by + padding + tabH + 14;
    const contentH = bh - padding * 2 - tabH - 14;

    // Trennlinie Liste / Detail
    const divX = bx + padding + listW;
    ctx.strokeStyle = 'rgba(180,140,80,0.2)';
    ctx.beginPath();
    ctx.moveTo(divX, contentY);
    ctx.lineTo(divX, contentY + contentH);
    ctx.stroke();

    // --- Liste links ---
    this._drawList(ctx, bx + padding, contentY, listW, contentH);

    // --- Detail rechts ---
    this._drawDetail(ctx, divX + padding, contentY, bw - listW - padding * 3, contentH);

    ctx.restore();
  }

  _drawList(ctx, lx, ly, lw, lh) {
    const entries = this._currentEntries();
    const itemH   = 40;

    // Scroll-Clamping
    const maxScroll = Math.max(0, entries.length * itemH - lh);
    this._listScroll = Math.min(this._listScroll, maxScroll);

    ctx.save();
    ctx.beginPath();
    ctx.rect(lx, ly, lw, lh);
    ctx.clip();

    if (entries.length === 0) {
      ctx.font         = '12px Georgia, serif';
      ctx.fillStyle    = 'rgba(255,255,255,0.25)';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Keine Einträge.', lx + lw / 2, ly + lh / 2);
      ctx.restore();
      return;
    }

    entries.forEach((entry, i) => {
      const ey = ly + i * itemH - this._listScroll;
      if (ey + itemH < ly || ey > ly + lh) return;

      const selected = i === this._selected;

      // Hover/Auswahl-Hintergrund
      if (selected) {
        ctx.fillStyle = 'rgba(180,140,80,0.25)';
        ctx.beginPath();
        ctx.roundRect(lx, ey + 2, lw - 4, itemH - 4, 6);
        ctx.fill();
      } else if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(lx, ey, lw, itemH);
      }

      // Titel
      ctx.font         = `${selected ? 'bold ' : ''}12px Georgia, serif`;
      ctx.fillStyle    = selected ? '#ffe090' : 'rgba(255,255,255,0.8)';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      const title = entry.title.length > 18 ? entry.title.substring(0, 17) + '…' : entry.title;
      ctx.fillText(title, lx + 8, ey + itemH / 2 - 6);

      // Timestamp
      ctx.font      = '9px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText(entry.timestamp, lx + 8, ey + itemH / 2 + 8);
    });

    ctx.restore();

    // Scroll-Pfeil unten
    if (this._listScroll < maxScroll) {
      ctx.font      = '12px sans-serif';
      ctx.fillStyle = 'rgba(180,140,80,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText('▼', lx + lw / 2, ly + lh - 4);
    }
    if (this._listScroll > 0) {
      ctx.font      = '12px sans-serif';
      ctx.fillStyle = 'rgba(180,140,80,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText('▲', lx + lw / 2, ly + 10);
    }
  }

  _drawDetail(ctx, dx, dy, dw, dh) {
    const entries = this._currentEntries();
    const entry   = this._selected !== null ? entries[this._selected] : null;

    if (!entry) {
      ctx.font         = '13px Georgia, serif';
      ctx.fillStyle    = 'rgba(255,255,255,0.2)';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('← Eintrag auswählen', dx + dw / 2, dy + dh / 2);
      return;
    }

    // Titel
    ctx.font         = 'bold 15px Georgia, serif';
    ctx.fillStyle    = '#ffe090';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(entry.title, dx, dy + 4);

    // Timestamp
    ctx.font      = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(entry.timestamp, dx, dy + 24);

    // Trennlinie
    ctx.strokeStyle = 'rgba(180,140,80,0.2)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(dx, dy + 40);
    ctx.lineTo(dx + dw, dy + 40);
    ctx.stroke();

    // Text (mit Zeilenumbruch)
    ctx.font         = '13px Georgia, serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.85)';
    ctx.textBaseline = 'top';
    this._wrapText(ctx, entry.text, dx, dy + 50, dw, 20);
  }

  _wrapText(ctx, text, x, y, maxW, lineH) {
    const lines = text.split('\n');
    let curY = y;
    for (const line of lines) {
      const words = line.split(' ');
      let row = '';
      for (const word of words) {
        const test = row ? row + ' ' + word : word;
        if (ctx.measureText(test).width > maxW && row) {
          ctx.fillText(row, x, curY);
          curY += lineH;
          row = word;
        } else {
          row = test;
        }
      }
      if (row) { ctx.fillText(row, x, curY); curY += lineH; }
      curY += 4; // Absatz-Abstand
    }
  }

  _currentEntries() {
    return this._entries[DIARY_CATEGORIES[this._tab]] || [];
  }

  // -------------------------------------------------------------------------
  // Icon (neben Logbook-Icon)
  // -------------------------------------------------------------------------
  drawIcon(ctx) {
    const ix = CANVAS_WIDTH - 88, iy = 8;
    ctx.save();
    ctx.fillStyle   = this.visible ? 'rgba(180,140,80,0.9)' : 'rgba(0,0,0,0.5)';
    ctx.strokeStyle = 'rgba(180,140,80,0.6)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(ix, iy, 36, 36, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font         = '20px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = this.visible ? '#000' : '#fff';
    ctx.fillText('📔', ix + 18, iy + 18);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Serialisierung
  // -------------------------------------------------------------------------
  toJSON()       { return this._entries; }
  fromJSON(data) { if (data) this._entries = data; }

  _timestamp() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  }
}
