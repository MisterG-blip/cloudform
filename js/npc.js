// ============================================================================
// NPC SYSTEM – A Cloud for ...
// Verwaltet NPC-Dialoge (linear + verzweigt) und Item-Tausch.
// NPCs werden pro Szene in der JSON definiert.
// ============================================================================

class NpcSystem {
  constructor() {
    this.active   = false;
    this.npc      = null;
    this.node     = null;
    this.choices  = [];
    this.onClose  = null;
    this._portraits = {};   // Cache: src → HTMLImageElement
  }

  _loadPortrait(src) {
    if (!src || this._portraits[src]) return;
    const img = new Image();
    img.onload  = () => { this._portraits[src] = img; };
    img.onerror = () => { this._portraits[src] = null; };
    img.src = src;
  }

  // -------------------------------------------------------------------------
  // Dialog starten
  // npcDef: NPC-Definition aus der JSON
  // inventory + itemDefs: für Tausch-Bedingungen
  // -------------------------------------------------------------------------
  start(npcDef, inventory, itemDefs, onClose = null) {
    this.active  = true;
    this.npc     = npcDef;
    this.onClose = onClose;
    this._loadPortrait(npcDef.portrait);
    const entryId = this._getEntryNode(npcDef, inventory);
    this._goToNode(entryId, inventory, itemDefs);
  }

  // -------------------------------------------------------------------------
  // Dialog starten wenn Spieler aktives Item auf NPC wirft (giveEntries)
  // Gibt true zurück wenn giveEntries behandelt wurde, sonst false
  // -------------------------------------------------------------------------
  startWithItem(npcDef, itemId, inventory, itemDefs, onClose = null) {
    const entries = npcDef.giveEntries;
    if (!entries) return false;

    // Spezifischen Eintrag suchen, dann Fallback '*'
    const nodeId = entries[itemId] ?? entries['*'] ?? null;
    if (!nodeId) return false;

    this.active  = true;
    this.npc     = npcDef;
    this.onClose = onClose;
    this._goToNode(nodeId, inventory, itemDefs);
    return true;
  }

  close() {
    this.active  = false;
    this.npc     = null;
    this.node    = null;
    this.choices = [];
    if (this.onClose) { const cb = this.onClose; this.onClose = null; cb(); }
  }

  // -------------------------------------------------------------------------
  // Einstiegs-Knoten ermitteln
  // NPCs können je nach Akt oder Inventar unterschiedlich starten
  // -------------------------------------------------------------------------
  _getEntryNode(npcDef, inventory) {
    if (!npcDef.entry) return 'start';

    // Bedingte Einstiege prüfen (erste passende gewinnt)
    if (Array.isArray(npcDef.entry)) {
      for (const e of npcDef.entry) {
        if (!e.condition) return e.node;
        if (this._checkCondition(e.condition, inventory)) return e.node;
      }
    }
    return npcDef.entry;
  }

  // -------------------------------------------------------------------------
  // Zu einem Dialog-Knoten navigieren
  // -------------------------------------------------------------------------
  _goToNode(nodeId, inventory, itemDefs) {
    const nodes = this.npc.dialog;
    const node  = nodes[nodeId];
    if (!node) { this.close(); return; }

    this.node = { ...node, id: nodeId };

    // Tausch auf Knoten-Ebene sofort ausführen
    if (node.trade) {
      const { give, receive } = node.trade;
      if (give && inventory.has(give)) inventory.remove(give);
      if (receive) {
        const itemDef = itemDefs[receive];
        if (itemDef) inventory.add({ id: receive, ...itemDef });
      }
    }

    // Item schenken ohne Tausch
    if (node.giveItem) {
      const itemDef = itemDefs[node.giveItem];
      if (itemDef && !inventory.has(node.giveItem)) {
        inventory.add({ id: node.giveItem, ...itemDef });
      }
    }

    // Auswahloptionen filtern (Bedingungen prüfen)
    this.choices = (node.choices || []).filter(c =>
      !c.condition || this._checkCondition(c.condition, inventory)
    );

    // Merken für handleClick
    this._inventory = inventory;
    this._itemDefs  = itemDefs;
  }

  // -------------------------------------------------------------------------
  // Klick verarbeiten
  // -------------------------------------------------------------------------
  handleClick(x, y, inventory, itemDefs) {
    if (!this.active || !this.node) return false;

    // Immer aktuell halten
    this._inventory = inventory;
    this._itemDefs  = itemDefs;

    // Auswahl geklickt?
    const layout = this._layout();
    for (let i = 0; i < layout.choices.length; i++) {
      const btn = layout.choices[i];
      if (btn && x >= btn.x && x <= btn.x + btn.w &&
                 y >= btn.y && y <= btn.y + btn.h) {
        this._selectChoice(i, inventory, itemDefs);
        return true;
      }
    }

    // Kein Auswahlmenü → weiterklicken
    if (this.choices.length === 0) {
      const next = this.node.next;
      if (next) {
        this._goToNode(next, inventory, itemDefs);
      } else {
        this.close();
      }
      return true;
    }

    return true;
  }

  _selectChoice(index, inventory, itemDefs) {
    const choice = this.choices[index];
    if (!choice) return;

    // Tausch ausführen
    if (choice.trade) {
      const { give, receive } = choice.trade;
      if (inventory.has(give)) {
        inventory.remove(give);
        const itemDef = itemDefs[receive];
        if (itemDef) inventory.add({ id: receive, ...itemDef });
      }
    }

    // Nächsten Knoten laden
    if (choice.next) {
      this._goToNode(choice.next, inventory, itemDefs);
    } else {
      this.close();
    }
  }

  // -------------------------------------------------------------------------
  // Bedingung prüfen (gleiche Logik wie HotspotSystem)
  // -------------------------------------------------------------------------
  _checkCondition(c, inventory) {
    if (!c) return true;
    if (c.itemInInventory)     return inventory.has(c.itemInInventory);
    if (c.itemNotInInventory)  return !inventory.has(c.itemNotInInventory);
    if (c.allItemsInInventory) return c.allItemsInInventory.every(id => inventory.has(id));
    return true;
  }

  // -------------------------------------------------------------------------
  // Zeichnen
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Word-Wrap
  // -------------------------------------------------------------------------
  _wrapText(ctx, text, maxWidth) {
    const lines = [];
    for (const paragraph of (text || '').split('\n')) {
      if (paragraph.trim() === '') { lines.push(''); continue; }
      const words = paragraph.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  // -------------------------------------------------------------------------
  // Layout — dynamisch, mit Portrait-Spalte
  // -------------------------------------------------------------------------
  _layout(ctx = null) {
    const PORTRAIT    = 100;
    const PAD         = 14;   // Innenabstand Box
    const GAP         = 12;   // Abstand Portrait → Text
    const LINE_H      = 22;
    const CHOICE_PAD  = 6;    // Extra-Abstand vor Choices

    const bx  = 50;
    const bw  = CANVAS_WIDTH - 100;

    // Textspalte beginnt rechts neben Portrait
    const textColX = bx + PAD + PORTRAIT + GAP;
    const textColW = bw - PAD - PORTRAIT - GAP - PAD;

    // --- NPC-Text umbrechen ---
    let textLines = [];
    if (ctx) {
      ctx.font = '15px sans-serif';
      textLines = this._wrapText(ctx, this.node?.text || '', textColW);
    } else {
      textLines = (this.node?.text || '').split('\n');
    }
    const textH = textLines.length * LINE_H;

    // Portrait-Block: 100px Bild + 18px Name
    const portraitBlockH = PORTRAIT + 18;

    // Linke Spalte bestimmt Mindesthöhe
    const leftH  = portraitBlockH;
    const rightH = textH;
    const contentH = Math.max(leftH, rightH);

    // --- Choices umbrechen ---
    const choiceDefs = [];
    if (ctx) {
      ctx.font = '13px sans-serif';
      for (const c of this.choices) {
        const wrapped = this._wrapText(ctx, `▸ ${c.text}`, textColW - 20);
        const h = Math.max(30, wrapped.length * 20 + 10);
        choiceDefs.push({ choice: c, lines: wrapped, h });
      }
    } else {
      for (const c of this.choices) {
        choiceDefs.push({ choice: c, lines: [`▸ ${c.text}`], h: 30 });
      }
    }
    const choicesH = choiceDefs.length > 0
      ? CHOICE_PAD + choiceDefs.reduce((s, c) => s + c.h + 4, 0)
      : 0;

    const bh = PAD + contentH + PAD + choicesH;
    const by = CANVAS_HEIGHT - bh - 20;

    // Choice-Positionen berechnen
    let cy = by + PAD + contentH + PAD + CHOICE_PAD;
    const choices = choiceDefs.map(def => {
      const entry = { ...def, x: bx + PAD, y: cy, w: bw - PAD * 2 };
      cy += def.h + 4;
      return entry;
    });

    return {
      box: { x: bx, y: by, w: bw, h: bh },
      portrait: { x: bx + PAD, y: by + PAD, size: PORTRAIT },
      nameY: by + PAD + PORTRAIT + 4,
      textX: textColX,
      textY: by + PAD,
      textLines,
      lineH: LINE_H,
      choices,
      PAD
    };
  }

  // -------------------------------------------------------------------------
  // Zeichnen
  // -------------------------------------------------------------------------
  draw(ctx) {
    if (!this.active || !this.node) return;

    const L = this._layout(ctx);
    const { box, portrait, nameY, textX, textY, textLines, lineH, choices } = L;

    ctx.save();

    // Box-Hintergrund
    ctx.fillStyle   = 'rgba(10,10,30,0.90)';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 12);
    ctx.fill();
    ctx.stroke();

    // Portrait
    const portraitImg = this._portraits[this.npc.portrait];
    if (portraitImg) {
      // Runder Clip
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(portrait.x, portrait.y, portrait.size, portrait.size, 8);
      ctx.clip();
      ctx.drawImage(portraitImg, portrait.x, portrait.y, portrait.size, portrait.size);
      ctx.restore();
      // Rahmen
      ctx.strokeStyle = 'rgba(255,220,80,0.5)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.roundRect(portrait.x, portrait.y, portrait.size, portrait.size, 8);
      ctx.stroke();
    } else {
      // Platzhalter
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(portrait.x, portrait.y, portrait.size, portrait.size, 8);
      ctx.fill();
    }

    // Name unter Portrait
    if (this.npc.name) {
      ctx.font      = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffe080';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(this.npc.name, portrait.x + portrait.size / 2, nameY);
    }

    // NPC-Text
    ctx.font      = '15px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    textLines.forEach((line, i) => {
      ctx.fillText(line, textX, textY + i * lineH);
    });

    // Choices oder Weiter-Hinweis
    if (choices.length > 0) {
      for (const btn of choices) {
        ctx.fillStyle   = 'rgba(255,255,255,0.08)';
        ctx.strokeStyle = 'rgba(255,220,80,0.5)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font      = '13px sans-serif';
        ctx.fillStyle = '#ffe080';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        btn.lines.forEach((line, i) => {
          ctx.fillText(line, btn.x + 10, btn.y + 6 + i * 20);
        });
      }
    } else {
      ctx.font      = '11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('[ klicken ]', box.x + box.w - 12, box.y + box.h - 10);
    }

    ctx.restore();
  }
}
