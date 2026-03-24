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
  private started = false;
  private currentTrack: 'field' | 'boss' | null = null;
  private generation = 0;

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
    } else if (this.ctx) {
      this.ctx.resume();
    }
    this.started = true;

    if (this.currentTrack === 'field') this.doPlay('field');
    else if (this.currentTrack === 'boss') this.doPlay('boss');
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
    const base = `./audio/${track}`;
    const gen  = this.generation;

    const tryUrl = (url: string, next?: () => void) => {
      if (gen !== this.generation) return;
      html.src = url;
      html.load();
      html.play().then(() => {
        if (gen !== this.generation) { html.pause(); return; }
        this.currentHtml = html;
      }).catch(() => {
        if (gen !== this.generation) return;
        next ? next() : this.fallbackToSynth(track, gen);
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
}
