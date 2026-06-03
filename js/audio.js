// ============================================================================
// AUDIO SYSTEM – A Cloud for Maybel
// Verwaltet Musik, Ambient, Effekte und Schritte.
// Lautstärken kommen vom RadioSystem (localStorage).
// ============================================================================

class AudioSystem {
  constructor() {
    // Lautstärken (0-1) — werden vom Radio gesetzt
    this.vol = {
      master:  1.0,
      music:   0.25,
      ambient: 0.5,
      sfx:     0.8,
      steps:   0.5,
    };

    // Audio-Nodes
    this._music   = null;   // globaler Musik-Loop
    this._ambient = null;   // aktueller Ambient-Loop
    this._steps   = null;   // Schritt-Loop

    // State
    this._stepsPlaying  = false;
    this._currentAmbient = null;
    this._currentMusic   = null;

    // Gecachte Audio-Elemente
    this._cache = {};
  }

  // -------------------------------------------------------------------------
  // Initialisierung — Lautstärken aus Radio laden
  // -------------------------------------------------------------------------
  init(radioSettings, playMusic = true) {
    if (radioSettings) {
      this.vol = { ...this.vol, ...radioSettings };
    }
    if (playMusic && MUSIC_SRC) this.playMusic(MUSIC_SRC);
  }

  // -------------------------------------------------------------------------
  // Lautstärke setzen (vom Radio)
  // -------------------------------------------------------------------------
  setVolume(type, value) {
    this.vol[type] = value;
    this._applyVolumes();
  }

  _applyVolumes() {
    if (this._music)   this._music.volume   = this._clamp(this.vol.master * this.vol.music);
    if (this._ambient) this._ambient.volume = this._clamp(this.vol.master * this.vol.ambient);
    if (this._steps)   this._steps.volume   = this._clamp(this.vol.master * this.vol.steps);
  }

  _clamp(v) { return Math.max(0, Math.min(1, v)); }

  // -------------------------------------------------------------------------
  // Musik
  // -------------------------------------------------------------------------
  playMusic(src) {
    if (this._currentMusic === src) return;
    if (this._music) { this._music.pause(); this._music = null; }
    if (!src) return;
    this._currentMusic = src;
    this._music = this._createAudio(src, true);
    this._music.volume = this._clamp(this.vol.master * this.vol.music);
    this._music.play().catch(() => {});
  }

  // -------------------------------------------------------------------------
  // Musik mit Crossfade wechseln
  // -------------------------------------------------------------------------
  crossfadeMusic(src, durationMs = 1500) {
    if (this._currentMusic === src) return;
    const oldMusic = this._music;
    if (oldMusic) {
      this._fadeOut(oldMusic, durationMs, () => { oldMusic.pause(); });
    }
    if (!src) { this._currentMusic = null; this._music = null; return; }
    this._currentMusic = src;
    const newMusic = this._createAudio(src, true);
    newMusic.volume = 0;
    newMusic.play().catch(() => {});
    this._fadeIn(newMusic, this._clamp(this.vol.master * this.vol.music), durationMs);
    this._music = newMusic;
  }
  playAmbient(src) {
    if (this._currentAmbient === src) return;
    if (this._ambient) {
      this._fadeOut(this._ambient, 800, () => { this._ambient = null; });
    }
    if (!src) { this._currentAmbient = null; return; }
    this._currentAmbient = src;
    const audio = this._createAudio(src, true);
    audio.volume = 0;
    audio.play().catch(() => {});
    this._fadeIn(audio, this._clamp(this.vol.master * this.vol.ambient), 800);
    this._ambient = audio;
  }

  // -------------------------------------------------------------------------
  // Schritte
  // -------------------------------------------------------------------------
  startSteps(src) {
    if (!src || this._stepsPlaying) return;
    this._stepsPlaying = true;
    if (!this._steps) {
      this._steps = this._createAudio(src, true);
      this._steps.volume = this._clamp(this.vol.master * this.vol.steps);
    }
    this._steps.play().catch(() => {});
  }

  stopSteps() {
    if (!this._stepsPlaying) return;
    this._stepsPlaying = false;
    if (this._steps) {
      this._steps.pause();
      this._steps.currentTime = 0;
    }
  }

  // -------------------------------------------------------------------------
  // Einmal-Effekte
  // -------------------------------------------------------------------------
  playSfx(src, volume = 1.0) {
    if (!src) return;
    const audio = this._createAudio(src, false);
    audio.volume = this._clamp(this.vol.master * this.vol.sfx * volume);
    audio.play().catch(() => {});
  }

  // -------------------------------------------------------------------------
  // Hilfsmethoden
  // -------------------------------------------------------------------------
  _createAudio(src, loop = false) {
    const audio = new Audio(src);
    audio.loop  = loop;
    return audio;
  }

  _fadeIn(audio, targetVol, durationMs) {
    const steps    = 20;
    const interval = durationMs / steps;
    const delta    = targetVol / steps;
    let   current  = 0;
    const timer = setInterval(() => {
      current = Math.min(targetVol, current + delta);
      audio.volume = current;
      if (current >= targetVol) clearInterval(timer);
    }, interval);
  }

  _fadeOut(audio, durationMs, onDone) {
    const steps    = 20;
    const interval = durationMs / steps;
    const delta    = audio.volume / steps;
    const timer = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - delta);
      if (audio.volume <= 0) {
        clearInterval(timer);
        audio.pause();
        if (onDone) onDone();
      }
    }, interval);
  }
}
