// ============================================================================
// CHARACTER – A Cloud for Maybel
// Spritesheet-basiert, 8 Richtungen, Idle-Behavior wie NPCs.
//
// SPRITESHEET-AUFBAU (frameW=1024, frameH=1024):
//   Reihe  0 – idle strip:  idle(0) / blink(1) / smile(2) / lookright(3)
//   Reihe  1 – idle_chew:   1 Frame
//   Reihe  2 – idle_gum:    5 Frames
//   Reihe  3 – walk_down
//   Reihe  4 – walk_downright
//   Reihe  5 – walk_right
//   Reihe  6 – walk_upright
//   Reihe  7 – walk_up
//   Reihe  8 – walk_upleft
//   Reihe  9 – walk_left
//   Reihe 10 – walk_downleft
//   (alle Walk-Reihen: 4 Frames)
// ============================================================================

const CHAR_SPEED = 180;  // px/s

const DIR_ROWS = [
  { state: 'walk_right', row: 5 },
  { state: 'walk_down',  row: 3 },
  { state: 'walk_left',  row: 9 },
  { state: 'walk_up',    row: 7 },
];

const STATES = {
  idle:       { row: 0, frames: 1, fps: 1, startFrame: 0 },
  blink:      { row: 0, frames: 1, fps: 1, startFrame: 1 },
  smile:      { row: 0, frames: 1, fps: 1, startFrame: 2 },
  lookright:  { row: 0, frames: 1, fps: 1, startFrame: 3 },
  idle_chew:  { row: 1, frames: 4, fps: 6, startFrame: 0 },
  idle_gum:   { row: 2, frames: 5, fps: 6, startFrame: 0 },
  walk_down:  { row: 3, frames: 4, fps: 6 },
  walk_right: { row: 4, frames: 4, fps: 6 },
  walk_up:    { row: 5, frames: 4, fps: 6 },
  walk_left:  { row: 6, frames: 4, fps: 6 },
};

const IDLE_BEHAVIOR = {
  idleState: 'idle',
  tickMs: 2000,
  reactions: [
    { state: 'idle',      weight: 40 },
    { state: 'blink',     weight: 30, durationMs:  150 },
    { state: 'smile',     weight: 13, durationMs:  800 },
    { state: 'lookright', weight: 10, durationMs: 1200 },
    { state: 'idle_chew', weight:  5, durationMs:  833 },
    { state: 'idle_gum',  weight:  2, durationMs:  833 },
  ]
};

class Character {
  constructor() {
    this.x = 400;
    this.y = 500;
    this.targetX = null;
    this.targetY = null;
    this.walking = false;
    this.onArrived = null;

    this.walkareaPoints = null;
    this.depthscale     = null;
    this.characterScale = 1.0;

    this.frameW    = 1024;
    this.frameH    = 1024;
    this.spriteSrc = null;
    this._img      = null;

    this._state     = 'idle';
    this._animFrame = 0;
    this._animTimer = 0;

    this._behaviorTimer        = 0;
    this._behaviorLocked       = false;
    this._behaviorLockTimer    = 0;
    this._behaviorLockDuration = 0;
  }

  // -------------------------------------------------------------------------
  // Sprite laden
  // -------------------------------------------------------------------------
  loadSprite(src) {
    if (!src || this.spriteSrc === src) return;
    this.spriteSrc = src;
    const img = new Image();
    img.onload  = () => { this._img = img; };
    img.onerror = () => { this._img = null; console.warn('Character sprite not found:', src); };
    img.src = src;
  }

  loadFromScreen(screen) {
    this.walkareaPoints = screen?.walkarea?.points ?? null;
    this.depthscale     = screen?.depthscale       ?? null;
    this.characterScale = screen?.characterScale   ?? 1.0;
    if (screen?.playerStart) {
      this.x = screen.playerStart.x;
      this.y = screen.playerStart.y;
    }
  }

  // -------------------------------------------------------------------------
  // Bewegung
  // -------------------------------------------------------------------------
  walkTo(x, y = null, callback = null) {
    let tx = x;
    let ty = y !== null ? y : this.y;
    if (this.walkareaPoints) {
      const c = this._clampToWalkarea(tx, ty);
      tx = c.x; ty = c.y;
    }
    this.targetX   = tx;
    this.targetY   = ty;
    this.onArrived = callback;
    this.walking   = true;
    this._setWalkState(tx - this.x, ty - this.y);
  }

  stop() {
    this.targetX = null;
    this.targetY = null;
    this.walking = false;
    this.onArrived = null;
    this._setState('idle');
  }

  _setWalkState(dx, dy) {
    // 4 Sektoren à 90°
    const angle  = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
    const sector = Math.round(angle / 90) % 4;
    this._setState(DIR_ROWS[sector].state);
  }

  _setState(state) {
    if (this._state === state) return;
    this._state     = state;
    this._animFrame = 0;
    this._animTimer = 0;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  update(deltaTime) {
    if (this.walking && this.targetX !== null) {
      this._updateMovement(deltaTime);
    } else {
      this._tickIdleBehavior(deltaTime);
    }
    this._tickAnimation(deltaTime);
  }

  _updateMovement(deltaTime) {
    const distX = this.targetX - this.x;
    const distY = this.targetY - this.y;
    const total = Math.hypot(distX, distY);
    const step  = CHAR_SPEED * (deltaTime / 1000);

    if (total <= step) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.walking = false;
      this.targetX = null;
      this.targetY = null;
      this._setState('idle');
      if (this.onArrived) {
        const cb = this.onArrived;
        this.onArrived = null;
        cb();
      }
    } else {
      const nx = this.x + (distX / total) * step;
      const ny = this.y + (distY / total) * step;
      if (this.walkareaPoints) {
        const c = this._clampToWalkarea(nx, ny);
        this.x = c.x; this.y = c.y;
      } else {
        this.x = nx; this.y = ny;
      }
      this._setWalkState(distX, distY);
    }
  }

  _tickIdleBehavior(deltaTime) {
    const beh = IDLE_BEHAVIOR;

    if (this._behaviorLocked) {
      this._behaviorLockTimer += deltaTime;
      if (this._behaviorLockTimer >= this._behaviorLockDuration) {
        this._behaviorLocked    = false;
        this._behaviorLockTimer = 0;
        this._setState(beh.idleState);
      }
      return;
    }

    this._behaviorTimer += deltaTime;
    if (this._behaviorTimer < beh.tickMs) return;
    this._behaviorTimer = 0;

    const totalWeight = beh.reactions.reduce((s, r) => s + (r.weight ?? 1), 0);
    let rand   = Math.random() * totalWeight;
    let chosen = beh.reactions[beh.reactions.length - 1];
    for (const r of beh.reactions) {
      rand -= (r.weight ?? 1);
      if (rand <= 0) { chosen = r; break; }
    }

    this._setState(chosen.state);
    if (chosen.durationMs) {
      this._behaviorLocked       = true;
      this._behaviorLockTimer    = 0;
      this._behaviorLockDuration = chosen.durationMs;
    }
  }

  _tickAnimation(deltaTime) {
    const cfg = STATES[this._state];
    if (!cfg || cfg.frames <= 1) return;
    this._animTimer += deltaTime;
    const frameTime = 1000 / (cfg.fps ?? 8);
    if (this._animTimer >= frameTime) {
      this._animTimer -= frameTime;
      this._animFrame  = (this._animFrame + 1) % cfg.frames;
    }
  }

  // -------------------------------------------------------------------------
  // Tiefen-Skalierung
  // -------------------------------------------------------------------------
  _getScale() {
    const base = this.characterScale ?? 1.0;
    if (!this.depthscale) return base;
    const { yNear, yFar, scaleNear, scaleFar } = this.depthscale;
    const t = Math.max(0, Math.min(1, (this.y - yFar) / (yNear - yFar)));
    return base * (scaleFar + t * (scaleNear - scaleFar));
  }

  // -------------------------------------------------------------------------
  // Draw
  // -------------------------------------------------------------------------
  draw(ctx) {
    const scale  = this._getScale();
    const cfg    = STATES[this._state] ?? STATES.idle;

    // 1024px Frames auf Spielgröße skalieren: * 0.1 → ~100px bei scale=1.0
    const drawW  = this.frameW * scale * 0.1;
    const drawH  = this.frameH * scale * 0.1;

    ctx.save();

    if (this._img) {
      const startFrame = cfg.startFrame ?? 0;
      const frameIndex = startFrame + this._animFrame;
      const srcX = frameIndex * this.frameW;
      const srcY = cfg.row    * this.frameH;
      const offsetY = 15;

      ctx.drawImage(
        this._img,
        srcX, srcY,
        this.frameW, this.frameH,
        this.x - drawW / 2,
        this.y - drawH + offsetY,
        drawW, drawH
      );
    } else {
      // Platzhalter-Figur solange kein Sprite geladen
      this._drawPlaceholder(ctx, scale);
    }

    ctx.restore();
  }

  _drawPlaceholder(ctx, scale) {
    const w   = 36 * scale;
    const h   = 64 * scale;
    const bob = this.walking ? (this._animFrame % 2 === 0 ? -2 : 2) : 0;
    ctx.translate(this.x, this.y);

    ctx.fillStyle = '#e8a87c';
    ctx.beginPath(); ctx.roundRect(-w/2, -h+bob, w, h*0.55, 6); ctx.fill();

    ctx.fillStyle = '#f5c5a0';
    ctx.beginPath(); ctx.arc(0, -h+bob-14*scale, 16*scale, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.arc(0, -h+bob-22*scale, 16*scale, Math.PI, 0); ctx.fill();

    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-5*scale, -h+bob-14*scale, 2.5*scale, 0, Math.PI*2);
    ctx.arc( 5*scale, -h+bob-14*scale, 2.5*scale, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#6b8cba';
    if (this.walking) {
      const swing = this._animFrame % 2 === 0 ? 6*scale : -6*scale;
      ctx.fillRect(-w/2,       -h*0.45+bob,        w*0.42, h*0.45);
      ctx.fillRect( w/2-w*0.42,-h*0.45+bob+swing,  w*0.42, h*0.45);
    } else {
      ctx.fillRect(-w/2, -h*0.45+bob, w, h*0.45);
    }
  }

  // -------------------------------------------------------------------------
  // Walkarea-Hilfsmethoden
  // -------------------------------------------------------------------------
  _clampToWalkarea(x, y) {
    if (!this.walkareaPoints || this.walkareaPoints.length < 3) return { x, y };
    if (this._pointInPolygon(x, y, this.walkareaPoints)) return { x, y };
    let best = null, bestDist = Infinity;
    const pts = this.walkareaPoints;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i+1) % pts.length];
      const c = this._closestPointOnSegment(x, y, a, b);
      const d = Math.hypot(c.x-x, c.y-y);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    return best || { x, y };
  }

  _pointInPolygon(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length-1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi))
        inside = !inside;
    }
    return inside;
  }

  _closestPointOnSegment(px, py, a, b) {
    const dx = b.x-a.x, dy = b.y-a.y;
    const lenSq = dx*dx + dy*dy;
    if (lenSq === 0) return { x: a.x, y: a.y };
    const t = Math.max(0, Math.min(1, ((px-a.x)*dx + (py-a.y)*dy) / lenSq));
    return { x: a.x+t*dx, y: a.y+t*dy };
  }

  // -------------------------------------------------------------------------
  // Debug
  // -------------------------------------------------------------------------
  drawWalkarea(ctx) {
    if (!this.walkareaPoints || this.walkareaPoints.length < 3) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,100,0.5)';
    ctx.fillStyle   = 'rgba(0,255,100,0.08)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(this.walkareaPoints[0].x, this.walkareaPoints[0].y);
    for (let i = 1; i < this.walkareaPoints.length; i++)
      ctx.lineTo(this.walkareaPoints[i].x, this.walkareaPoints[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
