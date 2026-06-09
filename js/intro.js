// ============================================================================
// INTRO SYSTEM – A Cloud for ...
// Zeigt 3–4 Screens mit Kamera-Pan-Effekt, Text und weiterklicken/Auto-Timer.
// ============================================================================

// -------------------------------------------------------------------------
// Konfiguration der Intro-Screens
// Jeder Screen braucht:
//   image     – Pfad zum Hintergrundbild (breiter als Canvas = Pan möglich)
//   text      – Anzeigetext (wird unten eingeblendet)
//   panFrom   – Start-X des Kameraausschnitts (0 = ganz links)
//   panTo     – End-X des Kameraausschnitts   (positiv = nach rechts)
//   duration  – Zeit in ms, bevor automatisch weitergeblättert wird
// -------------------------------------------------------------------------
const INTRO_SCREENS = [
   {
    image:    'assets/intro/intro_1.jpg',
    text:     'Die Stadt bewegt sich, ohne sich zu verändern.',
    panFrom:  0, panTo:    120,
    panFromY: 170, panToY: 170, 
    zoom:     0.5,
    duration: 6000,
  },
  {
    image:    'assets/intro/intro_2.jpg',
    text:     'Manchmal bleibt sie einfach stehen und schaut nach oben.',
    panFrom:  250, panTo: 250,
    panFromY: 100, panToY: 0, 
    zoom:     0.5,
    duration: 6000,
  },
  {
    image:    'assets/intro/intro_3.jpg',
    text:     'Wolken gehören niemandem, hat sie einmal gelernt.',
    panFrom:  250, panTo: 150,
    panFromY: 180, panToY: 0,
    zoom:     0.5, 
    duration: 6000,
  },
  {
    image:    'assets/intro/intro_4.jpg',
    text:     'Sie will nicht, dass sie verschwindet. Also fängt sie eine ein.',
    panFrom:  250, panTo:    250,
    panFromY: 0, panToY: 175, 
    zoom:     0.5,
    duration: 5000,
  },
];

// Fade-Dauer zwischen Screens (ms)
const INTRO_FADE_MS   = 800;
// Wie lang der Hinweis-Text pulsiert
const HINT_PULSE_MS   = 1200;

// ============================================================================

class IntroSystem {
  constructor() {
    this.active       = false;
    this._images      = [];      // vorgeladene HTMLImageElement
    this._screen      = 0;       // aktueller Index
    this._startTime   = 0;       // wann hat der aktuelle Screen begonnen
    this._fadeAlpha   = 0;       // 0 = unsichtbar, 1 = voll
    this._fadeDir     = 1;       // +1 = einblenden, -1 = ausblenden
    this._transitioning = false; // läuft gerade ein Fade-Out?
    this._onDone      = null;    // Callback wenn Intro fertig
    this._loaded      = false;
    this.fadingIn     = false;   // Fade-In nach Intro
    this._fadeInAlpha = 1;       // 1 = schwarz, 0 = fertig
    this._fadeInStart = 0;
  }

  // -------------------------------------------------------------------------
  // Bilder vorladen und dann starten
  // -------------------------------------------------------------------------
  async start(onDone) {
    this._onDone  = onDone;
    this._screen  = 0;
    this._fadeAlpha = 0;
    this._fadeDir   = 1;
    this._transitioning = false;
    this.active   = true;

    // Bilder laden (falls noch nicht geschehen)
    if (!this._loaded) {
      this._images = await Promise.all(
        INTRO_SCREENS.map(s => this._loadImage(s.image))
      );
      this._loaded = true;
    }

    this._startTime = performance.now();
  }

  _loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);  // fehlende Bilder → null, Fallback-Farbe
      img.src = src;
    });
  }

  // -------------------------------------------------------------------------
  // Klick / Touch → direkt weiter
  // -------------------------------------------------------------------------
  handleClick(x, y) {
    if (!this.active) return false;
    if (!this._transitioning) this._beginTransition();
    return true;
  }

  // -------------------------------------------------------------------------
  // Update (wird aus game._gameLoop aufgerufen)
  // -------------------------------------------------------------------------
  update(now) {
    if (!this.active) {
      if (this.fadingIn) {
        const t = (now - this._fadeInStart) / INTRO_FADE_MS;
        this._fadeInAlpha = Math.max(0, 1 - t);
        if (this._fadeInAlpha <= 0) this.fadingIn = false;
      }
      return;
    }

    const cfg     = INTRO_SCREENS[this._screen];
    const elapsed = now - this._startTime;

    // --- Einblenden ---
    if (this._fadeDir === 1) {
      this._fadeAlpha = Math.min(1, elapsed / INTRO_FADE_MS);
    }

    // --- Auto-Timer: nach duration ms automatisch weiterblättern ---
    if (!this._transitioning && elapsed >= cfg.duration) {
      this._beginTransition();
    }

    // --- Ausblenden ---
    if (this._transitioning) {
      const fadeStart = cfg.duration;
      const t = Math.min(1, (elapsed - fadeStart) / INTRO_FADE_MS);
      this._fadeAlpha = 1 - t;

      if (t >= 1) {
        this._nextScreen();
      }
    }
  }

  _beginTransition() {
    if (this._transitioning) return;
    this._transitioning = true;
    // Fake: wir setzen den "fadeStart"-Zeitpunkt auf jetzt,
    // indem wir duration kurz forcen
    const cfg     = INTRO_SCREENS[this._screen];
    const elapsed = performance.now() - this._startTime;
    if (elapsed < cfg.duration) {
      // Zeit vorspulen damit der Fade-Out-Timer sofort greift
      this._startTime = performance.now() - cfg.duration;
    }
  }

  _nextScreen() {
    this._screen++;
    if (this._screen >= INTRO_SCREENS.length) {
      this.active = false;
      this.fadingIn     = true;
      this._fadeInAlpha = 1;
      this._fadeInStart = performance.now();
      if (this._onDone) this._onDone();
      return;
    }
    this._startTime     = performance.now();
    this._fadeAlpha     = 0;
    this._fadeDir       = 1;
    this._transitioning = false;
  }

  // -------------------------------------------------------------------------
  // Draw
  // -------------------------------------------------------------------------
  draw(ctx, now) {
    if (!this.active) return;

    const cfg     = INTRO_SCREENS[this._screen];
    const elapsed = now - this._startTime;
    const img     = this._images[this._screen];

    ctx.save();
    ctx.globalAlpha = 1;

    // --- Hintergrund (schwarz) ---
    ctx.fillStyle = '#0a0814';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // --- Kamera-Pan berechnen ---
    const panT   = Math.min(1, elapsed / cfg.duration);   // 0→1 über die Laufzeit
    const panEased = this._easeInOut(panT);
    const panX = cfg.panFrom  + (cfg.panTo  - cfg.panFrom)  * panEased;
    const panY = (cfg.panFromY ?? 0) + ((cfg.panToY ?? 0) - (cfg.panFromY ?? 0)) * panEased;

    // --- Bild zeichnen (keine Skalierung, nur Pan) ---
    if (img) {
      const zoom   = cfg.zoom ?? 1;
      const scaledW = img.naturalWidth  * zoom;
      const scaledH = img.naturalHeight * zoom;

      ctx.globalAlpha = this._fadeAlpha;
      ctx.drawImage(img, -panX, -panY, scaledW, scaledH);
    } else {
      // Fallback wenn Bild fehlt: dunkler Farbverlauf
      ctx.globalAlpha = this._fadeAlpha;
      const grad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      grad.addColorStop(0, '#1a0a2e');
      grad.addColorStop(1, '#0a1628');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // --- Text-Box unten ---
    ctx.globalAlpha = this._fadeAlpha * this._textAlpha(elapsed, cfg.duration);
    this._drawTextBox(ctx, cfg.text);

    // --- Hinweis „weiterklicken" ---
    const hintAlpha = this._hintAlpha(elapsed, cfg.duration);
    if (hintAlpha > 0) {
      ctx.globalAlpha = this._fadeAlpha * hintAlpha;
      this._drawHint(ctx);
    }

    ctx.restore();
  }

  // Schwarzes Overlay über dem Gameplay nach dem Intro
  drawFadeIn(ctx) {
    if (!this.fadingIn || this._fadeInAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this._fadeInAlpha;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }

  // Textbox mit abgerundeten Ecken am unteren Rand
  _drawTextBox(ctx, text) {
    const PAD  = 28;
    const BH   = 90;
    const BY   = CANVAS_HEIGHT - BH - 30;
    const BW   = CANVAS_WIDTH  - PAD * 2;

    // Hintergrund
    ctx.fillStyle = 'rgba(5,3,18,0.78)';
    ctx.beginPath();
    ctx.roundRect(PAD, BY, BW, BH, 12);
    ctx.fill();

    // Rand
    ctx.strokeStyle = 'rgba(180,140,255,0.3)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Text
    ctx.font         = '16px Georgia, serif';
    ctx.fillStyle    = '#e8d8ff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    this._wrapText(ctx, text, CANVAS_WIDTH / 2, BY + BH / 2, BW - 40, 22);
  }

  // Hinweis am unteren Rand
  _drawHint(ctx) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / (HINT_PULSE_MS / (2 * Math.PI)));
    ctx.globalAlpha *= 0.4 + 0.6 * pulse;
    ctx.font         = '12px sans-serif';
    ctx.fillStyle    = 'rgba(200,180,255,0.9)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('[ Klicken zum Weiter ]', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10);
  }

  // Text-Alpha: langsam einblenden, am Ende kurz ausblenden
  _textAlpha(elapsed, duration) {
    const fadeIn  = Math.min(1, (elapsed - INTRO_FADE_MS) / 800);
    return Math.max(0, fadeIn);
  }

  // Hinweis erst nach 2s einblenden
  _hintAlpha(elapsed, duration) {
    const delay = 2000;
    return Math.max(0, Math.min(1, (elapsed - delay) / 600));
  }

  // Einfaches Ease-In-Out
  _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // Zeilenumbruch für Canvas-Text
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
