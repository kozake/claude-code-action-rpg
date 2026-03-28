// ============================================================
// AudioManager
// 1. まず ./audio/field.ogg (or .mp3) / boss.ogg を HTML Audio で再生
// 2. ファイルが存在しない場合は Web Audio API の合成 BGM にフォールバック
//    → public/audio/ に OGG/MP3 ファイルを追加すれば自動的に使われる
// ============================================================

type NoteEvent = { freq: number; beats: number; vol: number; type: OscillatorType };

// Field BGM fallback: D major, adventurous exploration, 140 BPM
const FIELD_BPM = 140;
const FIELD_MELODY: NoteEvent[] = [
  { freq: 293.66, beats: 0.5, vol: 0.30, type: 'square' },  // D4
  { freq: 369.99, beats: 0.5, vol: 0.26, type: 'square' },  // F#4
  { freq: 440.00, beats: 1,   vol: 0.30, type: 'square' },  // A4
  { freq: 493.88, beats: 0.5, vol: 0.28, type: 'square' },  // B4
  { freq: 440.00, beats: 0.5, vol: 0.26, type: 'square' },  // A4
  { freq: 369.99, beats: 0.5, vol: 0.26, type: 'square' },  // F#4
  { freq: 329.63, beats: 0.5, vol: 0.28, type: 'square' },  // E4
  { freq: 293.66, beats: 0.5, vol: 0.30, type: 'square' },  // D4
  { freq: 329.63, beats: 0.5, vol: 0.26, type: 'square' },  // E4
  { freq: 369.99, beats: 0.5, vol: 0.26, type: 'square' },  // F#4
  { freq: 440.00, beats: 0.5, vol: 0.30, type: 'square' },  // A4
  { freq: 369.99, beats: 0.5, vol: 0.26, type: 'square' },  // F#4
  { freq: 329.63, beats: 1,   vol: 0.28, type: 'square' },  // E4
  { freq: 293.66, beats: 1,   vol: 0.30, type: 'square' },  // D4
];
const FIELD_BASS: NoteEvent[] = [
  { freq: 73.42,  beats: 1, vol: 0.20, type: 'triangle' }, // D2
  { freq: 73.42,  beats: 1, vol: 0.16, type: 'triangle' }, // D2
  { freq: 55.00,  beats: 1, vol: 0.18, type: 'triangle' }, // A1
  { freq: 55.00,  beats: 1, vol: 0.14, type: 'triangle' }, // A1
  { freq: 61.74,  beats: 1, vol: 0.18, type: 'triangle' }, // B1
  { freq: 61.74,  beats: 1, vol: 0.14, type: 'triangle' }, // B1
  { freq: 55.00,  beats: 1, vol: 0.18, type: 'triangle' }, // A1
  { freq: 65.41,  beats: 1, vol: 0.16, type: 'triangle' }, // C2
];

// Boss BGM fallback: D minor, intense battle, 160 BPM
const BOSS_BPM = 160;
const BOSS_MELODY: NoteEvent[] = [
  { freq: 293.66, beats: 1,   vol: 0.38, type: 'square' }, // D4
  { freq: 293.66, beats: 0.5, vol: 0.32, type: 'square' }, // D4
  { freq: 349.23, beats: 0.5, vol: 0.32, type: 'square' }, // F4
  { freq: 440.00, beats: 1,   vol: 0.38, type: 'square' }, // A4
  { freq: 466.16, beats: 1,   vol: 0.32, type: 'square' }, // Bb4
  { freq: 440.00, beats: 0.5, vol: 0.32, type: 'square' }, // A4
  { freq: 349.23, beats: 0.5, vol: 0.32, type: 'square' }, // F4
  { freq: 293.66, beats: 2,   vol: 0.38, type: 'square' }, // D4 (held)
];
const BOSS_BASS: NoteEvent[] = [
  { freq: 73.42,  beats: 2, vol: 0.22, type: 'sawtooth' }, // D2
  { freq: 65.41,  beats: 2, vol: 0.18, type: 'sawtooth' }, // C2
  { freq: 58.27,  beats: 2, vol: 0.18, type: 'sawtooth' }, // Bb1
  { freq: 65.41,  beats: 2, vol: 0.18, type: 'sawtooth' }, // C2
];

export class AudioManager {
  private fieldHtml: HTMLAudioElement;
  private bossHtml: HTMLAudioElement;
  private currentHtml: HTMLAudioElement | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private started = false;
  private currentTrack: 'field' | 'boss' | null = null;
  private generation = 0;

  // Track whether boss audio has been pre-loaded/unlocked
  private bossReady = false;

  constructor() {
    this.fieldHtml = this.createHtmlAudio();
    this.bossHtml  = this.createHtmlAudio();
  }

  private createHtmlAudio(): HTMLAudioElement {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.5;
    audio.preload = 'none';
    return audio;
  }

  /** Determine the best audio URL for a track */
  private getAudioUrl(track: 'field' | 'boss'): string {
    const base = `./audio/${track}`;
    const testEl = this.fieldHtml;
    const canOgg = testEl.canPlayType('audio/ogg') !== '';
    return canOgg ? `${base}.ogg` : `${base}.mp3`;
  }

  // Call on first user gesture to unlock audio context
  unlock() {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.ctx && AC) {
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.ctx.destination);
    } else if (this.ctx) {
      this.ctx.resume();
    }
    this.started = true;

    // Pre-load and unlock boss audio during user gesture (field will be played immediately)
    this.preloadBossAudio();

    if (this.currentTrack === 'field') this.doPlay('field');
    else if (this.currentTrack === 'boss') this.doPlay('boss');
  }

  /** Pre-load boss audio element and unlock it for later playback (must be called from user gesture) */
  private preloadBossAudio() {
    const html = this.bossHtml;
    const url = this.getAudioUrl('boss');
    html.src = url;
    html.volume = 0; // mute during preload so boss BGM doesn't leak
    html.load();
    // Brief play+pause to unlock audio on mobile browsers
    const p = html.play();
    if (p) {
      p.then(() => {
        // Only pause if boss track is not actively playing (race condition guard)
        if (this.currentTrack !== 'boss') {
          html.pause();
          html.currentTime = 0;
        }
        html.volume = 0.5; // restore volume for actual playback
        this.bossReady = true;
      }).catch(() => {
        // Keep muted during retry (do NOT set volume to 0.5 here)
        // File might not exist or format unsupported; try fallback format
        const altUrl = url.endsWith('.ogg')
          ? './audio/boss.mp3'
          : './audio/boss.ogg';
        html.src = altUrl;
        html.load();
        const p2 = html.play();
        if (p2) {
          p2.then(() => {
            // Only pause if boss track is not actively playing (race condition guard)
            if (this.currentTrack !== 'boss') {
              html.pause();
              html.currentTime = 0;
            }
            html.volume = 0.5;
            this.bossReady = true;
          }).catch(() => { /* will use synth fallback */ });
        }
      });
    }
  }

  playField() {
    if (this.currentTrack === 'field') return;
    this.pauseHtml();
    this.generation++;
    this.currentTrack = 'field';
    if (this.started) this.doPlay('field');
  }

  playBoss() {
    if (this.currentTrack === 'boss') return;
    this.pauseHtml();
    this.generation++;
    this.currentTrack = 'boss';
    if (this.started) this.doPlay('boss');
  }

  stop() {
    this.pauseHtml();
    this.generation++;
    this.currentTrack = null;
  }

  private pauseHtml() {
    if (this.currentHtml) {
      this.currentHtml.pause();
      this.currentHtml.currentTime = 0;
      this.currentHtml = null;
    }
  }

  private doPlay(track: 'field' | 'boss') {
    const html = track === 'field' ? this.fieldHtml : this.bossHtml;
    const ready = track === 'boss' ? this.bossReady : false;
    const gen  = this.generation;

    // If audio was pre-loaded and unlocked, just play it directly
    if (ready && html.src) {
      html.currentTime = 0;
      const p = html.play();
      if (p) {
        p.then(() => {
          if (gen !== this.generation) { html.pause(); return; }
          this.currentHtml = html;
        }).catch(() => {
          if (gen !== this.generation) return;
          this.fallbackToSynth(track, gen);
        });
      }
      return;
    }

    // Fallback: try loading and playing (for cases where preload didn't work)
    const base = `./audio/${track}`;

    const tryUrl = (url: string, next?: () => void) => {
      if (gen !== this.generation) return;
      html.src = url;
      html.load();
      // Wait for enough data before playing
      const onReady = () => {
        html.removeEventListener('canplaythrough', onReady);
        if (gen !== this.generation) return;
        html.play().then(() => {
          if (gen !== this.generation) { html.pause(); return; }
          this.currentHtml = html;
        }).catch(() => {
          if (gen !== this.generation) return;
          next ? next() : this.fallbackToSynth(track, gen);
        });
      };
      html.addEventListener('canplaythrough', onReady);
      // Also try playing immediately in case it's already loaded
      html.play().then(() => {
        html.removeEventListener('canplaythrough', onReady);
        if (gen !== this.generation) { html.pause(); return; }
        this.currentHtml = html;
      }).catch(() => {
        // Wait for canplaythrough event, or timeout to synth
        setTimeout(() => {
          html.removeEventListener('canplaythrough', onReady);
          if (gen !== this.generation) return;
          if (!this.currentHtml || this.currentHtml !== html) {
            next ? next() : this.fallbackToSynth(track, gen);
          }
        }, 3000);
      });
    };

    const canOgg = html.canPlayType('audio/ogg') !== '';
    if (canOgg) {
      tryUrl(`${base}.ogg`, () => tryUrl(`${base}.mp3`));
    } else {
      tryUrl(`${base}.mp3`);
    }
  }

  private fallbackToSynth(track: 'field' | 'boss', gen: number) {
    this.currentHtml = null;
    if (this.ctx && this.masterGain && gen === this.generation) {
      this.synthLoop(track, gen);
    }
  }

  private synthLoop(track: 'field' | 'boss', gen: number) {
    if (gen !== this.generation || !this.ctx || !this.masterGain) return;

    const bpm    = track === 'field' ? FIELD_BPM : BOSS_BPM;
    const melody = track === 'field' ? FIELD_MELODY : BOSS_MELODY;
    const bass   = track === 'field' ? FIELD_BASS : BOSS_BASS;
    const beatSec = 60 / bpm;
    const startTime = this.ctx.currentTime + 0.05;

    const scheduleNotes = (pattern: NoteEvent[]): number => {
      let t = startTime;
      for (const note of pattern) {
        const dur = note.beats * beatSec;
        const osc = this.ctx!.createOscillator();
        const env = this.ctx!.createGain();
        osc.type = note.type;
        osc.frequency.value = note.freq;
        osc.connect(env);
        env.connect(this.masterGain!);

        const attack  = Math.min(0.02, dur * 0.1);
        const release = Math.min(0.08, dur * 0.3);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(note.vol, t + attack);
        env.gain.linearRampToValueAtTime(note.vol * 0.75, t + dur - release);
        env.gain.linearRampToValueAtTime(0, t + dur);

        osc.start(t);
        osc.stop(t + dur);
        t += dur;
      }
      return t - startTime;
    };

    const duration = scheduleNotes(melody);
    scheduleNotes(bass);

    setTimeout(() => this.synthLoop(track, gen), (duration - 0.05) * 1000);
  }

  // ================================================================
  // SFX — Web Audio API synthesized sound effects
  // ================================================================

  private playNoise(duration: number, volume: number, freqStart: number, freqEnd: number, type: OscillatorType = 'square') {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 20), t + duration);
    env.gain.setValueAtTime(volume, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  /** Player melee attack connects with enemy */
  playSfxHit() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Metallic slash
    this.playNoise(0.08, 0.35, 800, 200, 'sawtooth');
    // Impact thud
    this.playNoise(0.06, 0.25, 150, 60, 'square');
    // Bright click
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.04);
    env.gain.setValueAtTime(0.15, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  /** Critical hit — sharper, louder, with a ring */
  playSfxCrit() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Sharp slash
    this.playNoise(0.1, 0.45, 1400, 300, 'sawtooth');
    // Deep impact
    this.playNoise(0.08, 0.35, 200, 50, 'square');
    // High ring
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
    env.gain.setValueAtTime(0.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** Player takes damage */
  playSfxPlayerHurt() {
    if (!this.ctx || !this.sfxGain) return;
    // Low thud
    this.playNoise(0.15, 0.4, 120, 40, 'sawtooth');
    // Crunch
    this.playNoise(0.08, 0.3, 300, 80, 'square');
  }

  /** Enemy dies */
  playSfxEnemyDeath() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Pop burst
    this.playNoise(0.12, 0.3, 400, 60, 'square');
    // Scatter
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);
    env.gain.setValueAtTime(0.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** Boss phase transition roar */
  playSfxBossPhase() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Deep rumble
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60 + i * 30, t);
      osc.frequency.exponentialRampToValueAtTime(30 + i * 10, t + 0.5);
      env.gain.setValueAtTime(0.25, t + i * 0.05);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(env);
      env.connect(this.sfxGain);
      osc.start(t + i * 0.05);
      osc.stop(t + 0.5);
    }
    // High scream
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.6);
    env.gain.setValueAtTime(0.18, t + 0.1);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t + 0.1);
    osc.stop(t + 0.6);
  }

  /** Boss projectile fire */
  playSfxBossShoot() {
    if (!this.ctx || !this.sfxGain) return;
    this.playNoise(0.1, 0.25, 500, 150, 'sawtooth');
    this.playNoise(0.06, 0.2, 200, 80, 'square');
  }

  /** Item / XP pickup */
  playSfxPickup() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.08);
    env.gain.setValueAtTime(0.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /** Level up jingle */
  playSfxLevelUp() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = notes[i];
      env.gain.setValueAtTime(0, t + i * 0.08);
      env.gain.linearRampToValueAtTime(0.22, t + i * 0.08 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.15);
      osc.connect(env);
      env.connect(this.sfxGain);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.15);
    }
  }
}
