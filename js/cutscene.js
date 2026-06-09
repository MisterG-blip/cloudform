// ============================================================================
// CUTSCENE SYSTEM – A Cloud for ...
// Funktioniert wie das Intro: Pan, Zoom, Fade, Text, Klick/Auto-Timer.
// Cutscenes werden per Code definiert und per game.cutscene.play() gestartet.
// ============================================================================

// Fade-Dauer zwischen Screens (ms)
const CUTSCENE_FADE_MS = 800;
const CUTSCENE_HINT_PULSE_MS = 1200;

// ============================================================================
// Cutscene-Definitionen
// Jede Cutscene ist ein Array von Screens.
// ============================================================================

const CUTSCENES = {

  // Nach CloudShoot auf dem Dach → Übergang zu roof_act2
  roof_to_act2: [
    {
      image:    'assets/scenes/roof/act1/bg.png',
      text:     'Die Luft verändert sich. Etwas zieht herauf.',
      panFrom:  0,   panTo:   0,
      panFromY: 0,   panToY:  0,
      zoom:     0.5,
      duration: 4000,
    },
    {
      image:    'assets/scenes/roof/act2/bg.png',
      text:     'Die Wolken ziehen sich zusammen. Düster. Schwer.',
      panFrom:  0,   panTo:   300,
      panFromY: 0,   panToY:  0,
      zoom:     0.5,
      duration: 5000,
    },
  ],

};

// ============================================================================

class CutsceneSystem {
  constructor() {
    this.active         = false;
    this._screens       = [];
    this._screen        = 0;
    this._startTime     = 0;
    this._fadeAlpha     = 0;
    this._transitioning = false;
    this._onDone        = null;
    this._images        = {};   // gecachte Bilder { src: HTMLImageElement }

    // Fade-In nach letztem Screen
    this.fadingIn       = false;
    this._fadeInAlpha   = 1;
    this._fadeInStart   = 0;
  }

  // -------------------------------------------------------------------------
  // Starten
  // -------------------------------------------------------------------------
  play(cutsceneId, onDone) {
    const screens = CUTSCENES[cutsceneId];
    if (!screens) { console.warn('Cutscene nicht gefunden:', cutsceneId); onDone?.(); return; }

    this._screens       = screens;
    this._onDone        = onDone;
    this._screen        = 0;
    this._fadeAlpha     = 0;
    this._transitioning = false;
    this.active         = true;
    this._startTime     = performance.now();

    // Bilder vorladen
    this._preloadImages(screens.map(s => s.image));
  }

  _preloadImages(srcs) {
    for (const src of srcs) {
      if (this._images[src]) continue;
      const img = new Image();
      img.onload  = () => { this._images[src] = img; };
      img.onerror = () => { this._images[src] = null; };
      img.src = src;
    }
  }

  // -------------------------------------------------------------------------
  // Klick → weiter
  // -------------------------------------------------------------------------
  handleClick() {
    if (!this.active) return false;
    if (!this._transitioning) this._beginTransition();
    return true;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  update(now) {
    if (!this.active) {
      if (this.fadingIn) {
        const t = (now - this._fadeInStart) / CUTSCENE_FADE_MS;
        this._fadeInAlpha = Math.max(0, 1 - t);
        if (this._fadeInAlpha <= 0) this.fadingIn = false;
      }
      return;
    }

    const cfg     = this._screens[this._screen];
    const elapsed = now - this._startTime;

    // Einblenden
    if (!this._transitioning) {
      this._fadeAlpha = Math.min(1, elapsed / CUTSCENE_FADE_MS);
    }

    // Auto-Timer
    if (!this._transitioning && elapsed >= cfg.duration) {
      this._beginTransition();
    }

    // Ausblenden
    if (this._transitioning) {
      const t = Math.min(1, (elapsed - cfg.duration) / CUTSCENE_FADE_MS);
      this._fadeAlpha = 1 - t;
      if (t >= 1) this._nextScreen();
    }
  }

  _beginTransition() {
    if (this._transitioning) return;
    this._transitioning = true;
    const elapsed = performance.now() - this._startTime;
    const cfg     = this._screens[this._screen];
    if (elapsed < cfg.duration) {
      this._startTime = performance.now() - cfg.duration;
    }
  }

  _nextScreen() {
    this._screen++;
    if (this._screen >= this._screens.length) {
      this.active       = false;
      this.fadingIn     = true;
      this._fadeInAlpha = 1;
      this._fadeInStart = performance.now();
      if (this._onDone) this._onDone();
      return;
    }
    this._startTime     = performance.now();
    this._fadeAlpha     = 0;
    this._transitioning = false;
  }

  // -------------------------------------------------------------------------
  // Draw
  // -------------------------------------------------------------------------
  draw(ctx, now) {
    if (!this.active) return;

    const cfg     = this._screens[this._screen];
    const elapsed = now - this._startTime;
    const img     = this._images[cfg.image];

    ctx.save();

    // Schwarzer Hintergrund
    ctx.fillStyle = '#0a0814';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Pan berechnen
    const panT    = Math.min(1, elapsed / cfg.duration);
    const panEased = this._easeInOut(panT);
    const panX    = (cfg.panFrom  || 0) + ((cfg.panTo  || 0) - (cfg.panFrom  || 0)) * panEased;
    const panY    = (cfg.panFromY || 0) + ((cfg.panToY || 0) - (cfg.panFromY || 0)) * panEased;
    const zoom    = cfg.zoom ?? 1;

    // Bild zeichnen (keine Skalierung, nur Zoom + Pan)
    if (img && img.complete && img.naturalWidth > 0) {
      const scaledW = img.naturalWidth  * zoom;
      const scaledH = img.naturalHeight * zoom;
      ctx.globalAlpha = this._fadeAlpha;
      ctx.drawImage(img, -panX, -panY, scaledW, scaledH);
    } else {
      // Fallback
      ctx.globalAlpha = this._fadeAlpha;
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      grad.addColorStop(0, '#1a1a2e');
      grad.addColorStop(1, '#0a0814');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Text-Box
    ctx.globalAlpha = this._fadeAlpha * this._textAlpha(elapsed);
    this._drawTextBox(ctx, cfg.text);

    // Hinweis
    const hintA = this._hintAlpha(elapsed);
    if (hintA > 0) {
      ctx.globalAlpha = this._fadeAlpha * hintA;
      this._drawHint(ctx, now);
    }

    ctx.restore();
  }

  drawFadeIn(ctx) {
    if (!this.fadingIn || this._fadeInAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this._fadeInAlpha;
    ctx.fillStyle   = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }

  _drawTextBox(ctx, text) {
    const PAD = 28, BH = 90;
    const BY  = CANVAS_HEIGHT - BH - 30;
    const BW  = CANVAS_WIDTH  - PAD * 2;

    ctx.fillStyle   = 'rgba(5,3,18,0.78)';
    ctx.strokeStyle = 'rgba(180,140,255,0.3)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(PAD, BY, BW, BH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.font         = '16px Georgia, serif';
    ctx.fillStyle    = '#e8d8ff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    this._wrapText(ctx, text, CANVAS_WIDTH / 2, BY + BH / 2, BW - 40, 22);
  }

  _drawHint(ctx, now) {
    const pulse = 0.5 + 0.5 * Math.sin(now / (CUTSCENE_HINT_PULSE_MS / (2 * Math.PI)));
    ctx.globalAlpha *= 0.4 + 0.6 * pulse;
    ctx.font         = '12px sans-serif';
    ctx.fillStyle    = 'rgba(200,180,255,0.9)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('[ Klicken zum Weiter ]', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10);
  }

  _textAlpha(elapsed) {
    return Math.max(0, Math.min(1, (elapsed - CUTSCENE_FADE_MS) / 800));
  }

  _hintAlpha(elapsed) {
    return Math.max(0, Math.min(1, (elapsed - 2000) / 600));
  }

  _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  _wrapText(ctx, text, x, cy, maxWidth, lineHeight) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const totalH = lines.length * lineHeight;
    let y = cy - totalH / 2 + lineHeight / 2;
    for (const l of lines) {
      ctx.fillText(l, x, y);
      y += lineHeight;
    }
  }
}
